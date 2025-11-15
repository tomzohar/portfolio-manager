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

from ..agent_state import ToolResult
from ..tool_registry import tool

logger = logging.getLogger(__name__)


@tool(
    name="assess_confidence",
    description="Evaluates confidence level based on data completeness. Use this to determine if more analysis is needed.",
    parameters={
        "portfolio": {
            "type": "Dict[str, Any]",
            "description": "The portfolio data from parse_portfolio",
            "required": True
        },
        "analysis_results": {
            "type": "Dict[str, Dict[str, Any]]",
            "description": "All accumulated analysis results",
            "required": True
        }
    },
    examples=[
        '{"tool": "assess_confidence", "args": {"portfolio": "<current_portfolio>", "analysis_results": "<current_results>"}}'
    ]
)
def assess_confidence_tool(
    portfolio: Dict[str, Any],
    analysis_results: Dict[str, Dict[str, Any]]
) -> ToolResult:
    """
    Assess Confidence Tool
    
    Evaluates the agent's confidence in making recommendations based on
    the completeness and quality of gathered data.
    
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
    
    **Args:**
        portfolio: Portfolio data dict with keys:
            - total_value: float
            - positions: List[Dict] with ticker info
        
        analysis_results: Dict mapping tickers to their analysis:
            {
                "AAPL": {"news": {...}, "technicals": {...}},
                "MSFT": {"news": {...}},
                ...
            }
    
    **Returns:**
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
        >>> result = assess_confidence_tool(
        ...     portfolio=state["portfolio"],
        ...     analysis_results=state["analysis_results"]
        ... )
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
        
        return ToolResult(
            success=True,
            data=assessment,
            error=None,
            confidence_impact=0.0,  # This tool doesn't add new data, just assesses
        )
    
    except Exception as e:
        logger.error(f"Failed to assess confidence: {str(e)}", exc_info=True)
        return ToolResult(
            success=False,
            data=None,
            error=f"Confidence assessment failed: {str(e)}",
            confidence_impact=0.0,
        )

