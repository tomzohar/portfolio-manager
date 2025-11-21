"""Builds the autonomous agent graph."""
from langgraph.graph import StateGraph, END
from src.portfolio_manager.agent_state import AgentState
from .nodes import (
    start_node,
    agent_decision_node,
    tool_execution_node,
    final_report_node,
    guardrail_node
)
from .edges import route_after_agent_decision, route_after_guardrail


def build_graph() -> StateGraph:
    """
    Construct the LangGraph for the autonomous portfolio manager.
    
    Returns:
        Compiled StateGraph ready for execution
    """
    workflow = StateGraph(AgentState)
    
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
