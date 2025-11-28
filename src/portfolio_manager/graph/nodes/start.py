"""Graph start node."""
import logging
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.tools.parse_portfolio import parse_portfolio_tool

logger = logging.getLogger(__name__)


def start_node(state: dict) -> dict:
def start_node(state: dict) -> dict:
    """
    Initial node in the graph. 
    
    Responsibilities:
    1. Validate initial state
    2. Load portfolio data from Google Sheets
    3. Initialize workflow
    """
    logger.info("Starting a new analysis run...")
    _ = AgentState.model_validate(state)  # Validate at the start
    
    # Check if portfolio data already loaded (e.g., from tests)
    if not state.get("portfolio"):
        logger.info("Loading portfolio data from Google Sheets...")
        try:
            # Load portfolio using parse_portfolio_tool
            portfolio_result = parse_portfolio_tool()
            
            if portfolio_result.success:
                logger.info("✓ Portfolio data loaded successfully")
                
                # Extract tickers list for V3 workflow
                portfolio_data = portfolio_result.data
                if portfolio_data and "positions" in portfolio_data:
                    tickers = [pos["ticker"] for pos in portfolio_data["positions"]]
                    portfolio_data["tickers"] = tickers
                    logger.info(f"Extracted {len(tickers)} tickers: {', '.join(tickers)}")
                
                return {
                    "portfolio": portfolio_data,
                    "scratchpad": state.get("scratchpad", []) + [
                        "Portfolio loaded from Google Sheets"
                    ]
                }
            else:
                logger.error(f"Failed to load portfolio: {portfolio_result.error}")
                return {
                    "errors": state.get("errors", []) + [
                        f"Failed to load portfolio: {portfolio_result.error}"
                    ]
                }
        except Exception as e:
            logger.error(f"Exception loading portfolio: {e}", exc_info=True)
            return {
                "errors": state.get("errors", []) + [
                    f"Exception loading portfolio: {str(e)}"
                ]
            }
    else:
        logger.info("Portfolio data already present in state")
    
    return state
