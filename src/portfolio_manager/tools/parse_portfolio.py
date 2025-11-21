"""
Parse Portfolio Tool

This tool retrieves and parses the user's stock portfolio from Google Sheets.
It wraps the portfolio_manager integration module and converts the data format to
match the autonomous agent's standardized schema.

The tool is typically the first one called in any workflow, as all other
analysis tools depend on having portfolio data available.

Author: Portfolio Manager Agent
Version: 1.1.0 (Migrated to new integrations)
"""

import logging
from typing import Dict

from ..agent_state import ToolResult
from ..integrations.google_sheets import parse_portfolio
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
    1. Calls `parse_portfolio()` from `portfolio_manager.integrations.google_sheets`
    2. Converts Pydantic models to dict format
    3. Adds placeholder fields (gain/loss) not available in raw sheet
    
    **Returns:**
    ... (same as before)
    """
    try:
        logger.info("Tool invoked: parse_portfolio")
        
        # Call the new integration function
        portfolio = parse_portfolio()
        
        # Convert Pydantic model to dict for JSON serialization and add extra fields
        portfolio_dict = {
            "total_value": portfolio.total_value,
            "positions": [
                {
                    "ticker": pos.symbol,
                    "shares": pos.position,
                    "avg_price": pos.price,  # Currently sheet only has current price
                    "current_price": pos.price,
                    "market_value": pos.market_value,
                    "unrealized_gain_loss": 0.0,  # Placeholder
                    "unrealized_gain_loss_pct": 0.0,  # Placeholder
                    "weight": pos.percent_of_total / 100.0 if pos.percent_of_total else 0.0,
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
            api_calls=[],  # No metered API calls (Google Sheets is free quota)
        )
    
    except Exception as e:
        logger.error(f"Failed to parse portfolio: {str(e)}", exc_info=True)
        return ToolResult(
            success=False,
            data=None,
            error=f"Portfolio parsing failed: {str(e)}",
            confidence_impact=-0.5,  # Critical failure
        )
