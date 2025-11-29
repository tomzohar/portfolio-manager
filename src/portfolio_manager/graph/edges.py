"""Conditional edges for the agent graph."""
import logging
from typing import Literal
from src.portfolio_manager.agent_state import AgentState

logger = logging.getLogger(__name__)


def route_after_agent_decision(state: dict) -> Literal["execute_tool", "generate_report", "end"]:
    """
    Route the workflow based on the agent's decision.
    
    - If the agent chose a tool, execute it.
    - If the agent chose to generate a report, move to the final node.
    - If there are critical errors or max iterations are reached, end the process.
    """
    state_model = AgentState.model_validate(state)
    
    if state_model.errors and len(state_model.errors) > 3:
        logger.warning("Terminating run due to excessive errors.")
        return "end"

    if state_model.current_iteration >= state_model.max_iterations:
        logger.info("Max iterations reached. Generating final report.")
        return "generate_report"

    if state_model.next_tool_call:
        return "execute_tool"
    else:
        return "generate_report"


def route_after_guardrail(state: dict) -> Literal["agent", "generate_report", "end"]:
    """
    Routes the workflow after the guardrail check.

    - If the guardrail signals termination, end the run.
    - If the guardrail signals to force a final report, route to that node.
    - Otherwise, continue to the agent for the next decision.
    """
    state_model = AgentState.model_validate(state)

    if state_model.terminate_run:
        logger.warning("Guardrail triggered termination of the run.")
        return "end"
    
    if state_model.force_final_report:
        logger.info("Guardrail is forcing the final report.")
        return "generate_report"
    
    return "agent"


# =====================================================================
# Phase 3: V3 Supervisor Multi-Agent Architecture Routing Functions
# =====================================================================


def route_after_reflexion(state: dict) -> Literal["synthesis", "final_report"]:
    """
    Route after Reflexion Node's self-critique.
    
    Determines whether to loop back to Synthesis for revision or
    continue to Final Report generation.
    
    Loop back conditions:
    1. Reflexion rejected synthesis (reflexion_approved = False)
    2. Haven't reached max reflexion iterations (default: 2)
    
    Otherwise, continue to Final Report.
    
    Args:
        state: Current agent state
        
    Returns:
        "synthesis" to loop back for revision
        "final_report" to continue to finalization
    """
    state_model = AgentState.model_validate(state)
    
    approved = state_model.reflexion_approved
    iteration = state_model.reflexion_iteration
    max_iterations = 2  # Hard-coded maximum reflexion loops
    
    # Loop back only if:
    # 1. Not approved
    # 2. Haven't hit max iterations
    if not approved and iteration < max_iterations:
        logger.info(
            f"Reflexion rejected synthesis. Looping back to Synthesis Node "
            f"(iteration {iteration + 1}/{max_iterations})."
        )
        return "synthesis"
    
    # Continue to final report
    if approved:
        logger.info("Reflexion approved synthesis. Proceeding to Final Report.")
    else:
        logger.warning(
            f"Reflexion max iterations ({max_iterations}) reached. "
            f"Auto-approving and proceeding to Final Report."
        )
    
    return "final_report"


def route_after_start(state: dict) -> Literal["supervisor", "agent"]:
    """
    Route after Start Node to determine workflow type.
    
    V3 Supervisor Pattern: If portfolio has tickers, use supervisor workflow
    V2 Legacy Pattern: Otherwise, fall back to legacy agent workflow
    
    Args:
        state: Current agent state
        
    Returns:
        "supervisor" for V3 multi-agent workflow
        "agent" for V2 legacy single-agent workflow
    """
    state_model = AgentState.model_validate(state)
    
    # Check if portfolio has tickers (V3 workflow)
    if state_model.portfolio and state_model.portfolio.get("tickers"):
        logger.info("Routing to V3 Supervisor Multi-Agent workflow.")
        return "supervisor"
    
    # Fallback to V2 legacy workflow
    logger.info("Routing to V2 Legacy single-agent workflow.")
    return "agent"


def route_after_supervisor(state: dict) -> Literal["synthesis", "end"]:
    """
    Route after Supervisor Node delegation.
    
    If all sub-agents completed successfully, proceed to Synthesis.
    Otherwise, end with error.
    
    Args:
        state: Current agent state
        
    Returns:
        "synthesis" to proceed to synthesis
        "end" if critical failures occurred
    """
    state_model = AgentState.model_validate(state)
    
    sub_agent_status = state_model.sub_agent_status
    
    # Check if any critical sub-agents failed
    critical_agents = ["macro_agent", "risk_agent"]
    failed_critical = [
        agent for agent in critical_agents
        if sub_agent_status.get(agent) == "failed"
    ]
    
    if failed_critical:
        logger.error(
            f"Critical sub-agents failed: {', '.join(failed_critical)}. "
            f"Terminating workflow."
        )
        return "end"
    
    # Check if at least Fundamental or Technical succeeded
    analysis_agents = ["fundamental_agent", "technical_agent"]
    successful_analysis = [
        agent for agent in analysis_agents
        if sub_agent_status.get(agent) == "completed"
    ]
    
    if not successful_analysis:
        logger.error(
            "No analysis sub-agents completed successfully. "
            "Terminating workflow."
        )
        return "end"
    
    # All checks passed, proceed to synthesis
    logger.info(
        f"Supervisor completed. {len([s for s in sub_agent_status.values() if s == 'completed'])} "
        f"sub-agents successful. Proceeding to Synthesis."
    )
    return "synthesis"
