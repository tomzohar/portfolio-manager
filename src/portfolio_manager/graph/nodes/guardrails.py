"""
Guardrail Node
"""
from typing import List, Dict, Any
import logging
from ...agent_state import AgentState, ToolResult
from ...utils import estimate_cost

logger = logging.getLogger(__name__)

MAX_LLM_CALLS = 20
MAX_COST = 1.00

def _aggregate_api_calls(state: AgentState) -> List[Dict[str, Any]]:
    """Aggregates API calls from the last tool result and the agent's direct calls."""
    newly_completed_api_calls = state.get("newly_completed_api_calls", [])
    
    tool_results = state.get("tool_results")
    if isinstance(tool_results, list) and tool_results:
        last_tool_result = tool_results[-1]
        if isinstance(last_tool_result, ToolResult) and last_tool_result.api_calls:
            newly_completed_api_calls.extend(last_tool_result.api_calls)
            
    return newly_completed_api_calls

def _update_state_with_api_usage(state: AgentState, api_calls: List[Dict[str, Any]]) -> AgentState:
    """Updates the state's API counts and estimated cost."""
    current_counts = state.get("api_call_counts", {})
    for call in api_calls:
        api_type = call.get("api_type")
        count = call.get("count", 0)
        if api_type:
            current_counts[api_type] = current_counts.get(api_type, 0) + count
    state["api_call_counts"] = current_counts

    new_cost = estimate_cost(api_calls)
    current_cost = state.get("estimated_cost", 0.0)
    state["estimated_cost"] = current_cost + new_cost
    
    state["newly_completed_api_calls"] = []
    return state

def _check_guardrail_limits(state: AgentState) -> AgentState:
    """Checks the state against predefined limits and updates errors and termination flags."""
    errors = state.get("errors", [])
    terminate_run = False
    
    # Check LLM calls
    if state.get("api_call_counts", {}).get("llm", 0) > MAX_LLM_CALLS:
        error_msg = f"Guardrail breached: Maximum LLM calls exceeded (limit: {MAX_LLM_CALLS})."
        logger.error(error_msg)
        errors.append(error_msg)
        terminate_run = True

    # Check total cost
    if state.get("estimated_cost", 0.0) > MAX_COST:
        error_msg = f"Guardrail breached: Maximum estimated cost exceeded (limit: ${MAX_COST:.2f})."
        logger.error(error_msg)
        errors.append(error_msg)
        terminate_run = True

    state["errors"] = errors
    state["terminate_run"] = terminate_run
    return state

def guardrail_node(state: AgentState) -> AgentState:
    """
    Checks the current state against cost and usage limits.
    """
    new_api_calls = _aggregate_api_calls(state)
    state = _update_state_with_api_usage(state, new_api_calls)
    state = _check_guardrail_limits(state)
    
    return state
