"""
Parse Portfolio Tool

This tool retrieves and parses the user's stock portfolio from Google Sheets.
It wraps the legacy portfolio_parser module and converts the data format to
match the autonomous agent's standardized schema.

The tool is typically the first one called in any workflow, as all other
analysis tools depend on having portfolio data available.

Author: Portfolio Manager Agent
Version: 1.0.0
"""

from typing import Dict, Any
import logging

from stock_researcher.agents.portfolio_parser import parse_portfolio as parse_portfolio_legacy
from ..agent_state import ToolResult
from ..tool_registry import tool

logger = logging.getLogger(__name__)


@tool(
    name="parse_portfolio",
    description="Retrieves the user's portfolio from Google Sheets. Must be called first to load portfolio data.",
    parameters={},
    examples=[
        '{"tool": "parse_portfolio", "args": {}}'
    ]
)
def parse_portfolio_tool() -> ToolResult:
    """
    Parse Portfolio Tool
    
    Retrieves the user's stock portfolio from Google Sheets and converts it
    to the agent's standardized format.
    
    **Data Flow:**
    1. Calls legacy `parse_portfolio()` from stock_researcher
    2. Converts field names from legacy format to agent format:
       - `symbol` → `ticker`
       - `position` → `shares`
       - `percent_of_total` (0-100) → `weight` (0.0-1.0)
    3. Adds placeholder fields not available in legacy:
       - `unrealized_gain_loss` = 0.0
       - `unrealized_gain_loss_pct` = 0.0
    
    **Returns:**
        ToolResult with:
        - success: True if portfolio was successfully parsed
        - data: Dict containing:
            - total_value: float - Total portfolio value
            - positions: List[Dict] - Each position with:
                - ticker: str - Stock symbol
                - shares: float - Number of shares
                - avg_price: float - Average purchase price (currently = current_price)
                - current_price: float - Current market price
                - market_value: float - Total position value
                - unrealized_gain_loss: float - Dollar gain/loss (placeholder: 0.0)
                - unrealized_gain_loss_pct: float - Percent gain/loss (placeholder: 0.0)
                - weight: float - Position weight as decimal (0.0-1.0)
        - error: None on success, error message string on failure
        - confidence_impact: 0.2 on success (essential data), -0.5 on failure
    
    **Example:**
        >>> result = parse_portfolio_tool()
        >>> if result.success:
        ...     portfolio = result.data
        ...     print(f"Total value: ${portfolio['total_value']:,.2f}")
        ...     for pos in portfolio['positions']:
        ...         print(f"{pos['ticker']}: {pos['shares']} shares @ ${pos['current_price']}")
    
    **Error Handling:**
        - Google Sheets authentication failures
        - Network connectivity issues
        - Missing or malformed spreadsheet data
        - Invalid cell values (non-numeric prices, etc.)
        
        All errors are caught, logged, and returned in the ToolResult.error field.
    
    **Side Effects:**
        - Reads from Google Sheets (via gspread library)
        - Logs info/error messages
        - No state modifications
    
    **Performance:**
        - Typical execution: 1-2 seconds
        - Network-dependent (Google Sheets API call)
        - No caching (fetches fresh data every time)
    """
    try:
        logger.info("Tool invoked: parse_portfolio")
        portfolio = parse_portfolio_legacy()
        
        # Convert Portfolio object to dict for JSON serialization
        # Note: legacy uses 'symbol' not 'ticker', 'position' not 'shares'
        portfolio_dict = {
            "total_value": portfolio.total_value,
            "positions": [
                {
                    "ticker": pos.symbol,  # Map symbol -> ticker
                    "shares": pos.position,  # Map position -> shares
                    "avg_price": pos.price,  # Note: this is current price, not avg
                    "current_price": pos.price,
                    "market_value": pos.market_value,
                    "unrealized_gain_loss": 0.0,  # Not available in legacy
                    "unrealized_gain_loss_pct": 0.0,  # Not available in legacy
                    "weight": pos.percent_of_total / 100.0,  # Convert % to decimal
                }
                for pos in portfolio.positions
            ]
        }
        
        logger.info(f"Portfolio parsed successfully: {len(portfolio.positions)} positions")
        
        return ToolResult(
            success=True,
            data=portfolio_dict,
            error=None,
            confidence_impact=0.2,  # Having portfolio data is essential
            state_patch={"portfolio": portfolio_dict},
            api_calls=[],  # No external API calls with cost
        )
    
    except Exception as e:
        logger.error(f"Failed to parse portfolio: {str(e)}", exc_info=True)
        return ToolResult(
            success=False,
            data=None,
            error=f"Portfolio parsing failed: {str(e)}",
            confidence_impact=-0.5,  # Critical failure
        )

