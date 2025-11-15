"""
Utility Functions for the Autonomous Agent

This module contains helper functions used across the agent's workflow,
primarily for formatting and summarizing the agent's state. These functions
help create concise, readable summaries of the current situation to be
fed into the LLM prompt, ensuring the agent has the context it needs
without exceeding token limits.
"""

from typing import Dict, List, Any
import logging

from .agent_state import AgentState

logger = logging.getLogger(__name__)


def format_portfolio_summary(portfolio: Dict[str, Any]) -> str:
    """
    Generate a concise, human-readable summary of the portfolio.
    
    Args:
        portfolio: The portfolio data dictionary.
        
    Returns:
        A formatted string summarizing the portfolio's key metrics.
    """
    if not portfolio:
        return "Portfolio has not been loaded yet."
    
    summary = [
        f"Portfolio Summary:",
        f"  - Total Value: ${portfolio.get('total_value', 0):,.2f}",
        f"  - Total Positions: {len(portfolio.get('positions', []))}",
        f"  - Top 5 Positions:"
    ]
    
    # Sort positions by value and take the top 5
    sorted_positions = sorted(
        portfolio.get("positions", []),
        key=lambda p: p.get("market_value", 0),
        reverse=True
    )[:5]
    
    for pos in sorted_positions:
        percentage = pos.get('percentage_of_portfolio', 0) * 100
        summary.append(
            f"    - {pos['ticker']}: ${pos.get('market_value', 0):,.2f} ({percentage:.2f}%)"
        )
        
    return "\n".join(summary)


def format_analysis_summary(analysis_results: Dict[str, Dict[str, Any]]) -> str:
    """
    Summarize which analyses have already been performed.
    
    Args:
        analysis_results: The dictionary containing analysis results for each ticker.
        
    Returns:
        A formatted string listing the completed analyses.
    """
    if not analysis_results:
        return "No analysis has been performed yet."
        
    summary = ["Completed Analyses:"]
    for ticker, analyses in analysis_results.items():
        completed = [
            analysis_type for analysis_type, result in analyses.items() if result
        ]
        if completed:
            summary.append(f"  - {ticker}: {', '.join(completed)}")
            
    return "\n".join(summary)


def format_reasoning_trace(trace: List[str]) -> str:
    """
    Format the agent's reasoning trace for inclusion in the prompt.
    
    Args:
        trace: A list of strings representing the agent's past decisions.
        
    Returns:
        A formatted string of the last few reasoning steps.
    """
    if not trace:
        return "No actions taken yet."
    
    # Show the last 5 steps for brevity
    last_steps = trace[-5:]
    return "Previous Actions:\n" + "\n".join(f"- {step}" for step in last_steps)


def format_state_for_llm(state: AgentState) -> str:
    """
    Create a comprehensive summary of the current agent state for the LLM.
    
    This function compiles information about the portfolio, completed analyses,
    and recent actions into a single, concise string. This summary serves as the
    primary context for the LLM to make its next decision.
    
    Args:
        state: The current agent state.
        
    Returns:
        A formatted string summarizing the entire state.
    """
    try:
        portfolio_summary = format_portfolio_summary(state.get("portfolio"))
        analysis_summary = format_analysis_summary(state.get("analysis_results", {}))
        
        return f"""
{portfolio_summary}

{analysis_summary}
"""
    except Exception as e:
        logger.error(f"Failed to format state for LLM: {e}", exc_info=True)
        return "Error: Could not format the current state."


def deep_merge(source: Dict, destination: Dict) -> Dict:
    """
    Recursively merge two dictionaries.
    
    Args:
        source: The dictionary with new data.
        destination: The dictionary to merge into.
        
    Returns:
        The merged dictionary.
    """
    for key, value in source.items():
        if isinstance(value, dict) and key in destination and isinstance(destination[key], dict):
            destination[key] = deep_merge(value, destination[key])
        else:
            destination[key] = value
    return destination
