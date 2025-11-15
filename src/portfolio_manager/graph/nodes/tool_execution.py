"""Graph node for executing agent-selected tools."""
import logging
from datetime import datetime
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.tools import execute_tool
from src.portfolio_manager.utils import deep_merge

logger = logging.getLogger(__name__)


def tool_execution_node(state: AgentState) -> AgentState:
    """
    Execute the tool chosen by the agent and update the state.
    
    This node:
    1. Reads the tool call decision from the state (set by the agent_decision_node).
    2. Executes the specified tool with its arguments.
    3. Merges the tool's returned `state_patch` into the current state.
    4. Manages confidence score updates and error logging.
    """
    tool_call = state.get("next_tool_call")
    
    if not tool_call:
        logger.warning("Tool execution node called with no tool specified")
        state["reasoning_trace"].append("No tool was selected by the agent.")
        return state
    
    tool_name = tool_call["tool"]
    tool_args = tool_call.get("args", {})
    
    logger.info(f"Executing tool: {tool_name} with args: {tool_args}")
    
    try:
        # Execute the tool using the central tool registry
        result = execute_tool(tool_name, **tool_args)
        
        # Record the tool call history
        state["tool_calls"].append({
            "tool": tool_name,
            "args": tool_args,
            "timestamp": datetime.utcnow().isoformat(),
            "success": result.success,
            "output": result.data if result.success else result.error
        })
        
        # Use the generic deep_merge to apply the state_patch
        if result.success and result.state_patch:
            state = deep_merge(result.state_patch, state)
        elif not result.success:
            state["errors"].append(result.error)

        # Update the overall confidence score
        state["confidence_score"] = min(
            1.0, max(0.0, state["confidence_score"] + result.confidence_impact)
        )
        
        # Update reasoning trace with tool result
        if result.success:
            state["reasoning_trace"].append(
                f"✓ Tool `{tool_name}` succeeded. Confidence changed by {result.confidence_impact:+.2f} to {state['confidence_score']:.2f}"
            )
        else:
            state["reasoning_trace"].append(
                f"✗ Tool `{tool_name}` failed: {result.error}. Confidence changed by {result.confidence_impact:+.2f}"
            )
            
    except Exception as e:
        logger.error(f"Unexpected error during tool execution: {e}", exc_info=True)
        state["errors"].append(f"Tool execution system error: {str(e)}")
        state["reasoning_trace"].append(f"✗ Unexpected system error while executing `{tool_name}`.")
    
    # Clear the next tool call and increment iteration
    state["next_tool_call"] = None
    state["current_iteration"] += 1
    
    return state
