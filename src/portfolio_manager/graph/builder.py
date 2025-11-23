"""Builds the autonomous agent graph."""
import logging
from langgraph.graph import StateGraph, END
from typing import TypedDict, Any, Optional, Annotated, Literal
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.utils import deep_merge
from .nodes import (
    start_node,
    agent_decision_node,
    tool_execution_node,
    final_report_node,
    guardrail_node,
    # Phase 3: V3 Supervisor Multi-Agent Nodes
    supervisor_node,
    synthesis_node,
    reflexion_node,
)
from .edges import (
    route_after_agent_decision,
    route_after_guardrail,
    # Phase 3: V3 Routing Functions
    route_after_reflexion,
    route_after_start,
    route_after_supervisor,
)

logger = logging.getLogger(__name__)

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
    # V2 Fields
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
    
    # Phase 2: Sub-Agent Outputs (V3 Multi-Agent Architecture)
    macro_analysis: Optional[dict[str, Any]]
    fundamental_analysis: dict[str, Any]
    technical_analysis: dict[str, Any]
    risk_assessment: Optional[dict[str, Any]]
    
    # Phase 3: Supervisor Orchestration & Reflexion
    execution_plan: Optional[dict[str, Any]]
    sub_agent_status: dict[str, str]
    synthesis_result: Optional[dict[str, Any]]
    reflexion_iteration: int
    reflexion_feedback: list[str]
    reflexion_approved: bool
    confidence_adjustment: float

def build_graph(version: str = "v3") -> StateGraph:
    """
    Construct the LangGraph for the autonomous portfolio manager.
    
    This function builds the graph for both V2 (legacy single-agent) and
    V3 (supervisor multi-agent) workflows.
    
    V2 Legacy Workflow (Single Agent):
        START → GUARDRAIL → AGENT → EXECUTE_TOOL → GUARDRAIL (loop) → FINAL_REPORT → END
    
    V3 Supervisor Workflow (Multi-Agent):
        START → SUPERVISOR → SYNTHESIS → REFLEXION → [Loop or Continue] → FINAL_REPORT → END
    
    Args:
        version: Workflow version to build. Options:
            - "v3" (default): Supervisor multi-agent workflow
            - "v2": Legacy single-agent workflow
            - "auto": Auto-detect based on portfolio data (legacy behavior)
    
    Returns:
        Compiled StateGraph ready for execution
        
    Raises:
        ValueError: If version is not "v2", "v3", or "auto"
    """
    if version not in ["v2", "v3", "auto"]:
        raise ValueError(f"Invalid version: {version}. Must be 'v2', 'v3', or 'auto'")
    
    logger.info(f"Building workflow graph with version: {version}")
    workflow = StateGraph(GraphState)
    
    # =============================
    # V2 Legacy Nodes (Existing)
    # =============================
    workflow.add_node("start", start_node)
    workflow.add_node("agent", agent_decision_node)
    workflow.add_node("execute_tool", tool_execution_node)
    workflow.add_node("final_report", final_report_node)
    workflow.add_node("guardrail", guardrail_node)
    
    # =============================
    # V3 Supervisor Nodes (Phase 3)
    # =============================
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("synthesis", synthesis_node)
    workflow.add_node("reflexion", reflexion_node)
    
    # =============================
    # Entry Point
    # =============================
    workflow.set_entry_point("start")
    
    # =============================
    # V2 Legacy Edges (Preserved for backward compatibility)
    # =============================
    
    # Conditional edge after start: route to V3 supervisor or V2 agent
    # If version is explicitly set, create a routing function that respects it
    if version == "v3":
        # Force V3 workflow
        def route_after_start_v3(state: dict) -> Literal["supervisor"]:
            """Force V3 supervisor workflow."""
            logging.getLogger(__name__).info("Using V3 Supervisor Multi-Agent workflow (forced).")
            return "supervisor"
        routing_func = route_after_start_v3
        routing_map = {"supervisor": "supervisor"}
    elif version == "v2":
        # Force V2 workflow
        def route_after_start_v2(state: dict) -> Literal["agent"]:
            """Force V2 legacy workflow."""
            logging.getLogger(__name__).info("Using V2 Legacy single-agent workflow (forced).")
            return "agent"
        routing_func = route_after_start_v2
        routing_map = {"agent": "guardrail"}
    else:  # version == "auto"
        # Auto-detect based on portfolio data
        routing_func = route_after_start
        routing_map = {
            "supervisor": "supervisor",  # V3 workflow
            "agent": "guardrail",        # V2 workflow (via guardrail first)
        }
    
    workflow.add_conditional_edges(
        "start",
        routing_func,
        routing_map
    )
    
    # Conditional edge after agent decision (V2 legacy)
    workflow.add_conditional_edges(
        "agent",
        route_after_agent_decision,
        {
            "execute_tool": "execute_tool",
            "generate_report": "final_report",
            "end": END
        }
    )
    
    # Edge from tool execution back to guardrail for the loop (V2 legacy)
    workflow.add_edge("execute_tool", "guardrail")

    # Conditional edge after guardrail (V2 legacy)
    workflow.add_conditional_edges(
        "guardrail",
        route_after_guardrail,
        {
            "agent": "agent",
            "generate_report": "final_report",
            "end": END
        }
    )
    
    # =============================
    # V3 Supervisor Workflow Edges (Phase 3)
    # =============================
    
    # Supervisor → Synthesis (after all sub-agents complete)
    workflow.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "synthesis": "synthesis",
            "end": END
        }
    )
    
    # Synthesis → Reflexion (always)
    workflow.add_edge("synthesis", "reflexion")
    
    # Reflexion → Loop back to Synthesis OR Continue to Final Report
    workflow.add_conditional_edges(
        "reflexion",
        route_after_reflexion,
        {
            "synthesis": "synthesis",      # Loop back for revision
            "final_report": "final_report"  # Continue to finalization
        }
    )
    
    # =============================
    # Terminal Edge (Both Workflows)
    # =============================
    workflow.add_edge("final_report", END)
    
    return workflow.compile()
