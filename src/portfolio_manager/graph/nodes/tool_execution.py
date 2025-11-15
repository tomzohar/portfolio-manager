"""Graph node for executing agent-selected tools."""
import logging
from datetime import datetime
from src.portfolio_manager.agent_state import AgentState, ToolResult
from src.portfolio_manager.tool_registry import execute_tool
from src.portfolio_manager.utils import deep_merge

logger = logging.getLogger(__name__)


def tool_execution_node(state: AgentState) -> AgentState:
    """
    Executes the tool chosen by the agent.
    """
    tool_name = state["current_tool_name"]
    tool_args = state["current_tool_args"]
    
    logger.info(f"Executing tool: {tool_name} with args: {tool_args}")

    # Execute the tool, passing the state for state-aware tools
    tool_result = execute_tool(tool_name, state=state, **tool_args)

    # Store the result to be processed by the guardrail node
    state["latest_tool_result"] = tool_result
    
    # Apply any direct state modifications from the tool
    if tool_result.success and tool_result.state_patch:
        deep_merge(tool_result.state_patch, state)

    return state
