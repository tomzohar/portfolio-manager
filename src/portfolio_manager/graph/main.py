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
    
    final_state = None
    # Stream the graph execution to log each step
    for chunk in graph.stream(initial_state):
        for key, value in chunk.items():
            logger.info(f"--- Node '{key}' finished ---")
            
            # Log agent decisions and reasoning
            if "agent_decision" in value:
                decision = value["agent_decision"]
                if decision and 'reasoning' in decision and 'tool_calls' in decision:
                    logger.info(f"Decision: {decision['reasoning']}")
                    if not decision['tool_calls']:
                        logger.info("  - No tool calls made.")
                    else:
                        for tool_call in decision['tool_calls']:
                            logger.info(f"  - Tool Call: {tool_call['name']}({tool_call['arguments']})")

            # Log tool execution results
            if "tool_results" in value and value["tool_results"]:
                for result in value["tool_results"]:
                    if result.success:
                        logger.info(f"Tool '{result.tool_name}' succeeded.")
                    else:
                        logger.warning(f"Tool '{result.tool_name}' failed: {result.error}")
            
            final_state = value
    
    logger.info("Workflow completed")
    
    # Ensure we return the final state from the last chunk
    if final_state:
        return final_state
        
    logger.error("Graph execution did not produce a final state.")
    return initial_state
