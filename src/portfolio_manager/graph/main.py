"""Main entry point for running the autonomous agent."""
import logging
from .builder import build_graph
from ..agent_state import AgentState  # Import the Pydantic model

logger = logging.getLogger(__name__)


def run_autonomous_analysis(max_iterations: int = 10):
    """
    Run the autonomous portfolio analysis workflow.
    
    Args:
        max_iterations: The maximum number of agent decision loops
    
    Returns:
        The final state of the workflow
    """
    logger.info("Building the autonomous agent graph...")
    app = build_graph()
    
    # Create the initial state using the Pydantic model
    initial_state = AgentState(max_iterations=max_iterations)
    
    logger.info("Starting analysis...")
    
    # Calculate LangGraph recursion limit:
    # Each agent iteration = 4 nodes (guardrail -> agent -> execute_tool -> guardrail)
    # Plus: 1 start node + 1 final_report node
    # Formula: (max_iterations * 4) + 10 (buffer for start, final_report, and safety margin)
    langgraph_recursion_limit = (max_iterations * 4) + 10
    
    logger.info(f"Setting LangGraph recursion limit to {langgraph_recursion_limit} "
                f"(max_iterations={max_iterations})")
    
    # The input to invoke must be a dictionary
    final_state = app.invoke(
        initial_state.model_dump(),
        config={"recursion_limit": langgraph_recursion_limit}
    )
    
    return final_state
