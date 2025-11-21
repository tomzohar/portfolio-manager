"""Graph start node."""
import logging
from src.portfolio_manager.agent_state import AgentState

logger = logging.getLogger(__name__)


def start_node(state: AgentState) -> AgentState:
    """
    Entry node - initializes the workflow
    """
    logger.info("=== Starting Autonomous Portfolio Analysis ===")
    state["reasoning_trace"].append("Workflow initiated")
    state["current_iteration"] = 1
    return state
