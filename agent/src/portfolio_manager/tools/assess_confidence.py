"""
Assess Confidence Tool

This tool evaluates the current confidence level based on data completeness
and quality. It's a meta-tool that helps the agent decide if it needs to
gather more information before generating recommendations.

The confidence assessment considers:
- Portfolio coverage (% of positions analyzed)
- Data type diversity (news + technicals vs just news)
- Data quality indicators

Author: Portfolio Manager Agent
Version: 1.0.0
"""

from typing import Dict, Any
import logging

from ..agent_state import ToolResult, AgentState
from ..tool_registry import tool

logger = logging.getLogger(__name__)


@tool(
    name="assess_confidence",
    description="Evaluates confidence level based on data completeness. Use this to determine if more analysis is needed. This tool reads directly from the current state and requires no arguments.",
    parameters={},
    examples=[
        '{"tool": "assess_confidence", "args": {}}'
    ],
    state_aware=True
)
def assess_confidence_tool(state: AgentState) -> ToolResult:
    """
    Assess Confidence Tool
    
    Evaluates the agent's confidence in making recommendations based on
    the completeness and quality of gathered data from the agent state.
    
    **Confidence Calculation:**
    
    Base confidence = Coverage * 0.5
    + 0.25 if news data available
    + 0.25 if technical data available
    Capped at 1.0 (100%)
    
    Where coverage = (analyzed positions) / (total positions)
    
    **Decision Logic:**
    - <0.60: "Continue gathering data" - Not enough information
    - 0.60-0.74: "Gathering data" - Making progress but not quite ready
    - ≥0.75: "Ready for final analysis" - Sufficient confidence
    
    Args:
        state: The current AgentState, containing all portfolio and analysis data.
    
    Returns:
        ToolResult with:
        - success: Always True (this tool doesn't fail)
        - data: Dict containing:
            - confidence: float (0.0-1.0) - Overall confidence score
            - coverage: float (0.0-1.0) - % of positions analyzed
            - analyzed_tickers: int - Number of tickers with any data
            - total_positions: int - Total portfolio positions
            - has_news: bool - Any news data available
            - has_technicals: bool - Any technical data available
            - recommendation: str - What the agent should do next
        - error: None
        - confidence_impact: 0.0 (doesn't add new data, just assesses)
    
    **Example:**
        >>> result = assess_confidence_tool(state=current_agent_state)
        >>> assessment = result.data
        >>> print(f"Confidence: {assessment['confidence']:.0%}")
        >>> print(f"Recommendation: {assessment['recommendation']}")
    
    **Usage Pattern:**
        The agent typically calls this tool after gathering some data to
        decide whether to:
        1. Continue analyzing more positions
        2. Deepen analysis on existing positions
        3. Generate final recommendations
    
    **Edge Cases:**
        - No portfolio: Returns 0% confidence with specific message
        - Empty analysis: Returns coverage-based confidence only
        - Partial analysis: Proportional confidence based on what's available
    
    **Performance:**
        - Instant (pure calculation, no I/O)
        - No external dependencies
        - No API calls
    
    **Side Effects:**
        - Logs info message
        - No state modifications
    
    **Notes:**
        - Confidence is a heuristic, not a guarantee
        - Thresholds (0.75) are configurable in graph.py
        - Does not evaluate data quality, only completeness
    """
    try:
        logger.info("Tool invoked: assess_confidence")
        
        # Support both dict and AgentState Pydantic model
        from src.portfolio_manager.agent_state import AgentState
        if isinstance(state, dict):
            state_model = AgentState.model_validate(state)
        else:
            state_model = state
        
        portfolio = state_model.portfolio
        analysis_results = state_model.analysis_results if state_model.analysis_results else {}

        # Edge case: No portfolio data yet
        if not portfolio:
            return ToolResult(
                success=True,
                data={
                    "confidence": 0.0,
                    "coverage": 0.0,
                    "analyzed_tickers": 0,
                    "total_positions": 0,
                    "has_news": False,
                    "has_technicals": False,
                    "recommendation": "Parse portfolio first"
                },
                error=None,
                confidence_impact=0.0,
                state_patch={"confidence_score": 0.0},
            )
        
        # Calculate metrics
        num_positions = len(portfolio.get("positions", []))
        analyzed_tickers = len(analysis_results)
        
        # Calculate coverage
        coverage = analyzed_tickers / num_positions if num_positions > 0 else 0
        
        # Check data types available
        has_news = any("news" in results for results in analysis_results.values())
        has_technicals = any("technicals" in results for results in analysis_results.values())
        
        # Calculate confidence using heuristic formula
        # Base: 50% weight on coverage
        # + 25% if we have news data
        # + 25% if we have technical data
        base_confidence = coverage * 0.5
        
        if has_news:
            base_confidence += 0.25
        
        if has_technicals:
            base_confidence += 0.25
        
        confidence = min(1.0, base_confidence)
        
        # Generate recommendation based on confidence
        if confidence < 0.60:
            recommendation = "Continue gathering data - insufficient information"
        elif confidence < 0.75:
            recommendation = "Gathering data - making progress"
        else:
            recommendation = "Ready for final analysis - sufficient confidence"
        
        assessment = {
            "confidence": confidence,
            "coverage": coverage,
            "analyzed_tickers": analyzed_tickers,
            "total_positions": num_positions,
            "has_news": has_news,
            "has_technicals": has_technicals,
            "recommendation": recommendation
        }
        
        logger.info(f"Confidence assessment: {confidence:.2%} ({recommendation})")
        
        # This tool's result isn't complex, but we can update the main confidence score directly
        # via a state patch, which is cleaner than the node doing it.
        state_patch = {"confidence_score": confidence}
        
        return ToolResult(
            success=True,
            data=assessment,
            error=None,
            confidence_impact=0.0,  # Confidence is now set via patch, impact is neutral
            state_patch=state_patch
        )
    
    except Exception as e:
        logger.error(f"Failed to assess confidence: {str(e)}", exc_info=True)
        return ToolResult(
            success=False,
            data=None,
            error=f"Confidence assessment failed: {str(e)}",
            confidence_impact=0.0,
        )

