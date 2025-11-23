"""
Supervisor Node - Portfolio Manager V3

Orchestrates multi-agent portfolio analysis workflow.
Implements ReAct pattern with query decomposition and delegation.
Coordinates execution of specialized sub-agents (Macro, Fundamental, Technical, Risk).

Architecture:
    Supervisor (Planning)
        ↓
    ┌───┴────┬──────────┬──────────┐
    ↓        ↓          ↓          ↓
Macro   Fundamental  Technical  Risk
Agent    Agent       Agent      Agent
    ↓        ↓          ↓          ↓
    └───┬────┴──────────┴──────────┘
        ↓
    Synthesis Node
"""

from typing import Dict, Any, List
import logging
import json
import sentry_sdk
from ...agent_state import AgentState
from ...schemas import ExecutionPlan
from ...config import settings
from .macro_agent import macro_agent_node
from .fundamental_agent import fundamental_agent_node
from .technical_agent import technical_agent_node
from .risk_agent import risk_agent_node
from src.stock_researcher.utils.llm_utils import call_gemini_api

logger = logging.getLogger(__name__)


def supervisor_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node for supervising multi-agent portfolio analysis.
    
    Implements cognitive protocol:
    1. Analyze user query and portfolio context
    2. Decompose into atomic sub-tasks
    3. Create execution plan (sequential vs. parallel)
    4. Delegate to sub-agents
    5. Track completion and update state
    
    Args:
        state: Current agent state with portfolio and scratchpad
        
    Returns:
        Updated state with sub-agent results and execution plan
        
    Example:
        >>> state = AgentState(
        ...     portfolio={"tickers": ["AAPL", "MSFT"]},
        ...     reasoning_trace=[]
        ... )
        >>> result = supervisor_node(state)
        >>> assert "execution_plan" in result
        >>> assert "sub_agent_status" in result
    """
    try:
        logger.info("═══ SUPERVISOR: PLANNING PHASE ═══")
        
        # 1. Extract context
        portfolio = state.portfolio
        if not portfolio:
            logger.error("No portfolio data available")
            return {
                "execution_plan": None,
                "errors": state.errors + ["No portfolio data available"]
            }
        
        tickers = portfolio.get("tickers", [])
        if not tickers:
            logger.error("No tickers in portfolio")
            return {
                "execution_plan": None,
                "errors": state.errors + ["No tickers in portfolio"]
            }
        
        user_query = getattr(state, 'user_query', None) or "Analyze my portfolio"
        
        logger.info(f"Portfolio: {len(tickers)} positions")
        logger.info(f"Tickers: {', '.join(tickers)}")
        logger.info(f"Query: {user_query}")
        
        # 2. Create execution plan using LLM
        execution_plan = _create_execution_plan(portfolio, user_query)
        
        logger.info("Execution Plan:")
        for i, task in enumerate(execution_plan.tasks, 1):
            logger.info(f"  {i}. {task}")
        
        # 3. Execute plan by delegating to sub-agents
        logger.info("═══ SUPERVISOR: EXECUTION PHASE ═══")
        
        updated_state = _execute_plan(state, execution_plan)
        
        # 4. Update state with execution metadata
        updated_state["execution_plan"] = execution_plan.model_dump()
        updated_state["reasoning_trace"] = state.reasoning_trace + [
            f"Supervisor: Completed {len(execution_plan.tasks)} tasks",
            f"Supervisor: All sub-agents finished successfully"
        ]
        
        logger.info("✓ Supervisor: All agents completed")
        
        return updated_state
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Supervisor Error: {e}", exc_info=True)
        return {
            "execution_plan": None,
            "errors": state.errors + [f"Supervisor error: {str(e)}"],
            "reasoning_trace": state.reasoning_trace + [
                f"Supervisor: Failed with error: {str(e)}"
            ]
        }


def _create_execution_plan(
    portfolio: Dict[str, Any],
    user_query: str
) -> ExecutionPlan:
    """
    Use LLM to create an execution plan based on portfolio and query.
    
    The LLM analyzes the user's request and portfolio composition to determine
    which sub-agents to invoke and in what order. For standard portfolio
    analysis, this typically follows: Macro → Fundamental + Technical (parallel) → Risk.
    
    Args:
        portfolio: Portfolio data with tickers and positions
        user_query: User's analysis request
        
    Returns:
        ExecutionPlan with ordered tasks and parallel group definitions
        
    Example:
        >>> portfolio = {"tickers": ["AAPL", "MSFT", "GOOGL"]}
        >>> plan = _create_execution_plan(portfolio, "Analyze my portfolio")
        >>> assert len(plan.tasks) >= 4
        >>> assert "Macro Agent" in plan.tasks[0]
    """
    tickers = portfolio.get("tickers", [])
    ticker_preview = ', '.join(tickers[:5])
    if len(tickers) > 5:
        ticker_preview += f', ... ({len(tickers)} total)'
    
    # Build prompt for LLM
    prompt = f"""You are a Portfolio Analysis Supervisor. Create an execution plan for the following request.

User Query: "{user_query}"
Portfolio: {len(tickers)} positions ({ticker_preview})

Available Sub-Agents:
1. Macro Agent - Analyzes market regime (inflation, growth, risk sentiment)
2. Fundamental Agent - Assesses company valuation and quality (per ticker)
3. Technical Agent - Analyzes price trends and timing (per ticker)
4. Risk Agent - Calculates portfolio risk metrics (requires all position data)

Create an execution plan as JSON:
{{
  "tasks": [
    "Invoke Macro Agent to establish market context",
    "Invoke Fundamental Agent for each ticker (parallel)",
    "Invoke Technical Agent for each ticker (parallel)",
    "Invoke Risk Agent to calculate portfolio metrics"
  ],
  "parallel_groups": [
    ["Fundamental Agent", "Technical Agent"]
  ],
  "rationale": "Brief explanation of plan"
}}

Guidelines:
- Macro Agent should run first (provides market context)
- Fundamental + Technical can run in parallel per ticker
- Risk Agent must run last (needs complete portfolio data)
- Be efficient: don't invoke agents unnecessarily

Output only valid JSON."""
    
    try:
        # Call LLM using centralized utility
        response_text = call_gemini_api(prompt, model=settings.AGENT_MODEL)
        
        # Parse JSON response
        plan_dict = json.loads(response_text)
        execution_plan = ExecutionPlan(**plan_dict)
        
        logger.info(f"LLM generated execution plan: {len(execution_plan.tasks)} tasks")
        return execution_plan
        
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"Failed to parse LLM plan, using default: {e}")
        
        # Fallback to default plan
        return ExecutionPlan(
            tasks=[
                "Invoke Macro Agent to establish market context",
                "Invoke Fundamental Agent for each ticker (batch)",
                "Invoke Technical Agent for each ticker (batch)",
                "Invoke Risk Agent to calculate portfolio metrics"
            ],
            parallel_groups=[["Fundamental Agent", "Technical Agent"]],
            rationale="Default sequential execution plan (fallback due to LLM parse error)"
        )


def _execute_plan(
    state: AgentState,
    execution_plan: ExecutionPlan
) -> Dict[str, Any]:
    """
    Execute the plan by delegating to sub-agents in the specified order.
    
    Implements graceful degradation: if one agent fails, continues with others.
    Tracks completion status for each sub-agent in sub_agent_status dict.
    
    Args:
        state: Current agent state
        execution_plan: Execution plan to follow
        
    Returns:
        Updated state dict with all sub-agent outputs
        
    Note:
        For MVP, parallel execution is simulated (sequential calls).
        True parallelization with asyncio can be added in future optimization.
    """
    # Convert Pydantic model to dict for updating
    updated_state = state.model_dump()
    
    # Track sub-agent completion status
    sub_agent_status = {}
    
    # Step 1: Macro Agent (always first, independent)
    logger.info("► Executing: Macro Agent")
    try:
        macro_result = macro_agent_node(state)
        updated_state.update(macro_result)
        sub_agent_status["macro_agent"] = "completed"
        logger.info("✓ Macro Agent completed")
    except Exception as e:
        logger.error(f"✗ Macro Agent failed: {e}", exc_info=True)
        sentry_sdk.capture_exception(e)
        sub_agent_status["macro_agent"] = "failed"
        updated_state["macro_analysis"] = None
    
    # Step 2: Fundamental + Technical (parallel batch)
    # Note: True parallelization would require asyncio, for MVP we'll do sequential
    logger.info("► Executing: Fundamental & Technical Agents (batch)")
    
    try:
        # Create state object from updated dict
        intermediate_state = AgentState(**updated_state)
        fundamental_result = fundamental_agent_node(intermediate_state)
        updated_state.update(fundamental_result)
        sub_agent_status["fundamental_agent"] = "completed"
        logger.info("✓ Fundamental Agent completed")
    except Exception as e:
        logger.error(f"✗ Fundamental Agent failed: {e}", exc_info=True)
        sentry_sdk.capture_exception(e)
        sub_agent_status["fundamental_agent"] = "failed"
        updated_state["fundamental_analysis"] = {}
    
    try:
        # Create state object from updated dict
        intermediate_state = AgentState(**updated_state)
        technical_result = technical_agent_node(intermediate_state)
        updated_state.update(technical_result)
        sub_agent_status["technical_agent"] = "completed"
        logger.info("✓ Technical Agent completed")
    except Exception as e:
        logger.error(f"✗ Technical Agent failed: {e}", exc_info=True)
        sentry_sdk.capture_exception(e)
        sub_agent_status["technical_agent"] = "failed"
        updated_state["technical_analysis"] = {}
    
    # Step 3: Risk Agent (requires all previous data)
    logger.info("► Executing: Risk Agent")
    try:
        # Create state object from updated dict
        intermediate_state = AgentState(**updated_state)
        risk_result = risk_agent_node(intermediate_state)
        updated_state.update(risk_result)
        sub_agent_status["risk_agent"] = "completed"
        logger.info("✓ Risk Agent completed")
    except Exception as e:
        logger.error(f"✗ Risk Agent failed: {e}", exc_info=True)
        sentry_sdk.capture_exception(e)
        sub_agent_status["risk_agent"] = "failed"
        updated_state["risk_assessment"] = None
    
    # Add status tracking to state
    updated_state["sub_agent_status"] = sub_agent_status
    
    # Log completion summary
    completed_count = sum(1 for status in sub_agent_status.values() if status == "completed")
    failed_count = sum(1 for status in sub_agent_status.values() if status == "failed")
    logger.info(f"Execution summary: {completed_count} completed, {failed_count} failed")
    
    return updated_state


def _batch_process_tickers(
    tickers: List[str],
    agent_func: callable,
    state: AgentState
) -> Dict[str, Any]:
    """
    Process multiple tickers through an agent (used for parallel execution).
    
    In MVP, this is sequential. In future, could use asyncio for true parallelism.
    Isolates state per ticker to prevent cross-contamination.
    
    Args:
        tickers: List of ticker symbols to process
        agent_func: Agent function to call (fundamental_agent_node or technical_agent_node)
        state: Current agent state
        
    Returns:
        Dict with results per ticker
        
    Note:
        This function is currently unused but provided for future optimization
        when implementing true parallel execution.
    """
    results = {}
    
    for ticker in tickers:
        try:
            # Create isolated state for single ticker
            ticker_state = state.model_copy(deep=True)
            ticker_state.portfolio = {"tickers": [ticker]}
            
            # Call agent with isolated state
            result = agent_func(ticker_state)
            results[ticker] = result
            
        except Exception as e:
            logger.error(f"Error processing {ticker}: {e}", exc_info=True)
            sentry_sdk.capture_exception(e)
            results[ticker] = {"error": str(e)}
    
    return results

