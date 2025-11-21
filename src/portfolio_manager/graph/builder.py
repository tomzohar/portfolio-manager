"""Builds the autonomous agent graph."""
from langgraph.graph import StateGraph, END
from typing import TypedDict, Any, Optional, Annotated
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.utils import deep_merge
from .nodes import (
    start_node,
    agent_decision_node,
    tool_execution_node,
    final_report_node,
    guardrail_node
)
from .edges import route_after_agent_decision, route_after_guardrail

def merge_analysis_results(left: dict[str, dict[str, Any]], right: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Custom reducer for analysis_results that deep-merges nested dictionaries."""
    if not left:
        return right
    if not right:
        return left
    # Deep merge right into left
    result = dict(left)
    return deep_merge(right, result)

# Define the graph state schema
# LangGraph requires explicit field definitions to know how to merge state updates
class GraphState(TypedDict, total=False):
    portfolio: Optional[dict[str, Any]]
    analysis_results: Annotated[dict[str, dict[str, Any]], merge_analysis_results]
    reasoning_trace: list[str]
    agent_reasoning: list[dict[str, Any]]
    next_tool_call: Optional[dict[str, Any]]
    tool_calls: list[dict[str, Any]]
    latest_tool_result: Optional[dict[str, Any]]
    confidence_score: float
    api_call_counts: dict[str, int]
    estimated_cost: float
    terminate_run: bool
    force_final_report: bool
    newly_completed_api_calls: list[dict[str, Any]]
    max_iterations: int
    current_iteration: int
    final_report: Optional[str]
    errors: list[str]
    started_at: str
    completed_at: Optional[str]

def build_graph() -> StateGraph:
    """
    Construct the LangGraph for the autonomous portfolio manager.
    
    Returns:
        Compiled StateGraph ready for execution
    """
    workflow = StateGraph(GraphState)
    
    # Add nodes
    workflow.add_node("start", start_node)
    workflow.add_node("agent", agent_decision_node)
    workflow.add_node("execute_tool", tool_execution_node)
    workflow.add_node("final_report", final_report_node)
    workflow.add_node("guardrail", guardrail_node)
    
    # Set entry point
    workflow.set_entry_point("start")
    
    # Add edges
    workflow.add_edge("start", "guardrail")
    
    # Conditional edge after agent decision
    workflow.add_conditional_edges(
        "agent",
        route_after_agent_decision,
        {
            "execute_tool": "execute_tool",
            "generate_report": "final_report",
            "end": END
        }
    )
    
    # Edge from tool execution back to agent for the loop
    workflow.add_edge("execute_tool", "guardrail")

    # Conditional edge after guardrail
    workflow.add_conditional_edges(
        "guardrail",
        route_after_guardrail,
        {
            "agent": "agent",
            "generate_report": "final_report",
            "end": END
        }
    )
    
    # Terminal edge
    workflow.add_edge("final_report", END)
    
    return workflow.compile()
