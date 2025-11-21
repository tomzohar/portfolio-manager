"""Graph node for executing agent-selected tools."""
import logging
from datetime import datetime
from src.portfolio_manager.agent_state import AgentState, ToolResult
from src.portfolio_manager.tool_registry import execute_tool
from src.portfolio_manager.utils import deep_merge
from src.portfolio_manager.error_handler import capture_error

logger = logging.getLogger(__name__)


def tool_execution_node(state: AgentState) -> AgentState:
    """
    Executes the tool chosen by the agent.
    """
    tool_name = state["current_tool_name"]
    tool_args = state["current_tool_args"]
    
    logger.info(f"Executing tool: {tool_name} with args: {tool_args}")

    try:
        # Execute the tool, passing the state for state-aware tools
        tool_result = execute_tool(tool_name, state=state, **tool_args)

        # Store the result to be processed by the guardrail node
        state["latest_tool_result"] = tool_result
        
        # Apply any direct state modifications from the tool
        if tool_result.success:
            if tool_result.state_patch:
                deep_merge(tool_result.state_patch, state)
        else:
            # If the tool failed, record the error in the main state
            error_message = f"Tool '{tool_name}' failed: {tool_result.error}"
            state["errors"].append(error_message)
            logger.error(error_message)

    except Exception as e:
        # Catch unexpected exceptions during tool execution
        error_message = f"An unexpected error occurred in tool '{tool_name}': {e}"
        logger.error(error_message, exc_info=True)
        state["errors"].append(error_message)
        capture_error(e)
        # Create a failure ToolResult to ensure consistent state
        state["latest_tool_result"] = ToolResult(success=False, error=str(e))

    return state
