"""Conditional edges for the agent graph."""
import logging
from typing import Literal
from src.portfolio_manager.agent_state import AgentState

logger = logging.getLogger(__name__)


def route_after_agent_decision(state: AgentState) -> Literal["execute_tool", "generate_report", "end"]:
    """
    Route the workflow based on the agent's decision.
    
    - If the agent chose a tool, execute it.
    - If the agent chose to generate a report, move to the final node.
    - If there are critical errors or max iterations are reached, end the process.
    """
    if state["errors"]:
        logger.warning(f"Errors found in state, stopping: {state['errors'][-1]}")
        return "end"
        
    if state["current_iteration"] > state["max_iterations"]:
        logger.warning("Max iterations reached, generating final report.")
        return "generate_report"
    
    if state.get("next_tool_call"):
        return "execute_tool"
    else:
        return "generate_report"
