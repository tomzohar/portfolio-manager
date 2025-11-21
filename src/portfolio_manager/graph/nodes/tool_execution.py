"""Graph node for executing agent-selected tools."""
import logging
from datetime import datetime
from src.portfolio_manager.agent_state import AgentState, ToolCall
from src.portfolio_manager.tools import execute_tool, get_registry
from src.portfolio_manager.utils import deep_merge
from src.portfolio_manager.error_handler import capture_error

logger = logging.getLogger(__name__)

def tool_execution_node(state: dict) -> dict:
    """
    Executes the tool chosen by the agent. 
    Handles both regular and state-aware tools.
    """
    state_model = AgentState.model_validate(state)
    tool_call = state_model.next_tool_call
    patch = {}

    if not tool_call or not isinstance(tool_call, dict) or "tool" not in tool_call:
        logger.warning(f"Tool execution node called with no tool specified. tool_call={tool_call}")
        patch["errors"] = state_model.errors + ["Tool execution node called with no tool specified."]
        return patch

    tool_name = tool_call.get("tool")
    tool_args = tool_call.get("args", {})
    
    logger.info(f"Executing tool: {tool_name} with args: {tool_args}")

    try:
        # Get the tool from the registry
        registry = get_registry()
        tool_metadata = registry.get_tool(tool_name)
        
        if tool_metadata and tool_metadata.state_aware:
            result = execute_tool(tool_name, state=state_model, **tool_args)
        else:
            result = execute_tool(tool_name, **tool_args)
        
        # Record the tool call
        new_tool_call = ToolCall(
            tool=tool_name,
            args=tool_args,
            timestamp=datetime.utcnow().isoformat(),
            success=result.success,
            output=result.data if result.success else result.error,
        )
        patch["tool_calls"] = state_model.tool_calls + [new_tool_call]
        
        # Update state with the result from the tool
        patch["latest_tool_result"] = result
        if result.state_patch:
            # Use deep_merge to properly combine nested dicts like analysis_results
            # deep_merge(source, destination) merges source into destination
            deep_merge(result.state_patch, patch)

        # Clear the next tool call after execution
        patch["next_tool_call"] = None

    except Exception as e:
        logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
        capture_error(e)
        patch["errors"] = state_model.errors + [f"Tool execution system error: {str(e)}"]
    
    return patch
