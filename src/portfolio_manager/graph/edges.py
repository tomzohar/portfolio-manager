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
    if state.get("next_tool_call"):
        return "execute_tool"
    else:
        return "generate_report"


def route_after_guardrail(state: AgentState) -> Literal["agent", "generate_report", "end"]:
    """
    Routes the workflow after the guardrail check.

    - If the guardrail signals termination, end the run.
    - If the guardrail signals to force a final report, route to that node.
    - Otherwise, continue to the agent for the next decision.
    """
    if state.get("terminate_run", False):
        logger.warning("Guardrail triggered termination of the run.")
        return "end"
    
    if state.get("force_final_report", False):
        logger.info("Guardrail is forcing the final report.")
        return "generate_report"
    
    return "agent"
