"""Main entry point for running the autonomous agent."""
import logging
from src.portfolio_manager.agent_state import AgentState, create_initial_state
from .builder import build_graph

logger = logging.getLogger(__name__)


def run_autonomous_analysis(max_iterations: int = 15) -> AgentState:
    """
    Main entry point for running the autonomous portfolio analysis.
    
    Args:
        max_iterations: Maximum number of agent decision loops.
    
    Returns:
        The final AgentState after workflow completion.
    """
    initial_state = create_initial_state(max_iterations=max_iterations)
    
    graph = build_graph()
    
    logger.info("Starting autonomous portfolio analysis workflow")
    final_state = graph.invoke(initial_state)
    
    logger.info("Workflow completed")
    return final_state
