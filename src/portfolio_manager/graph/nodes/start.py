"""Graph start node."""
import logging
from src.portfolio_manager.agent_state import AgentState

logger = logging.getLogger(__name__)


def start_node(state: dict) -> dict:
    """
    Initial node in the graph. Logs the start of the analysis.
    """
    # Pydantic model provides the default state, so we just log and proceed.
    logger.info("Starting a new analysis run...")
    _ = AgentState.model_validate(state) # Validate at the start
    return state
