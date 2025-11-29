"""
Utility Functions for the Autonomous Agent

This module contains helper functions used across the agent's workflow,
primarily for formatting and summarizing the agent's state. These functions
help create concise, readable summaries of the current situation to be
fed into the LLM prompt, ensuring the agent has the context it needs
without exceeding token limits.

It also provides centralized LLM API access with retry logic.
"""

from typing import Dict, List, Any, Optional
import logging
from enum import Enum

from google import genai
from tenacity import retry, stop_after_attempt, wait_exponential
import sentry_sdk

from .agent_state import AgentState
from .prompts import get_final_report_prompt
from .config import settings

logger = logging.getLogger(__name__)


def format_portfolio_summary(portfolio: Dict[str, Any] | None) -> str:
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
        # Support both 'weight' and 'percentage_of_portfolio' keys
        percentage = pos.get('weight', pos.get('percentage_of_portfolio', 0)) * 100
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
        state: The current agent state model.
        
    Returns:
        A formatted string summarizing the entire state.
    """
    try:
        portfolio_summary = format_portfolio_summary(state.portfolio)
        analysis_summary = format_analysis_summary(state.analysis_results)
        
        return f"""
{portfolio_summary}

{analysis_summary}
"""
    except Exception as e:
        logger.error(f"Failed to format state for LLM: {e}", exc_info=True)
        return "Error: Could not format the current state."


def format_state_for_final_report(state: AgentState) -> str:
    """
    Create a detailed summary of the final state for the final report LLM.
    
    Args:
        state: The final agent state model.
        
    Returns:
        A formatted string summarizing the portfolio and all analyses performed.
    """
    if not state.portfolio:
        return "ERROR: No portfolio was loaded."

    portfolio_summary = (
        f"Portfolio Value: ${state.portfolio.get('total_value', 0):,.2f}\n"
        f"Number of Positions: {len(state.portfolio.get('positions', []))}"
    )

    analysis_details = []
    for ticker, analyses in state.analysis_results.items():
        details = [f"--- {ticker} ---"]
        if "news" in analyses:
            details.append(f"News Analysis:\n{analyses['news']}")
        if "technicals" in analyses:
            details.append(f"Technical Analysis:\n{analyses['technicals']}")
        analysis_details.append("\n".join(details))

    return (
        f"{portfolio_summary}\n\n"
        "--- Detailed Analysis Results ---\n"
        f"{'\n\n'.join(analysis_details)}"
    )


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


# --- Cost Estimation ---

class ApiType(str, Enum):
    """Enum for API types to ensure consistency."""
    LLM_GEMINI_2_5_FLASH = "llm_gemini_2_5_flash"
    LLM_GEMINI_2_5_PRO = "llm_gemini_2_5_pro"
    SERP_API = "serp_api"
    POLYGON_API = "polygon_api"


API_COSTS = {
    ApiType.LLM_GEMINI_2_5_FLASH: 0.001 / 1000,
    ApiType.LLM_GEMINI_2_5_PRO: 0.01 / 1000,
    ApiType.SERP_API: 0.001,
    ApiType.POLYGON_API: 0.002,
}


def get_cost(api_type: ApiType, count: int) -> float:
    """Calculate the cost for a specific API call."""
    if api_type in API_COSTS:
        return API_COSTS[api_type] * count
    logger.warning(f"Unknown API type for cost estimation: {api_type}")
    return 0.0


def estimate_cost(api_calls: List[Dict[str, Any]]) -> float:
    """
    Estimate the cost of a list of API calls.

    Args:
        api_calls: A list of dictionaries, where each dictionary represents an API call
                   and contains 'api_type' and 'count' keys.

    Returns:
        The total estimated cost in USD.
    """
    total_cost = 0.0
    if not api_calls:
        return total_cost

    for call in api_calls:
        api_type_str = call.get("api_type")
        count = call.get("count", 0)
        
        try:
            api_type = ApiType(api_type_str)
            total_cost += get_cost(api_type, count)
        except ValueError:
            logger.warning(f"Invalid API type string for cost estimation: {api_type_str}")

    return total_cost


# --- LLM API Integration ---

# Using a common, robust model
LLM_MODEL = 'gemini-2.5-flash'

# Lazy initialization - client is created only when first needed
_gemini_client: Optional[genai.Client] = None


def _get_gemini_client() -> genai.Client:
    """
    Lazy initialization of the Gemini client.
    
    Only creates the client when first called, not at module import time.
    This allows tests to import the module without needing API keys.
    
    Returns:
        The initialized Gemini API client.
        
    Raises:
        ValueError: If GEMINI_API_KEY is not configured.
    """
    global _gemini_client
    
    if _gemini_client is None:
        if not settings.GEMINI_API_KEY:
            error_msg = "GEMINI_API_KEY is not set. Please configure it in your environment."
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.debug("Initializing Gemini API client")
        _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    return _gemini_client


def _call_gemini_api_impl(prompt: str, model: str) -> str:
    """
    Internal implementation of Gemini API call.
    Separated for retry logic.
    """
    client = _get_gemini_client()
    
    # Make the API call
    response = client.models.generate_content(
        model=model,
        contents=prompt
    )
    
    # Log response metrics if available
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        usage = response.usage_metadata
        total_tokens = getattr(usage, 'total_token_count', 0)
        prompt_tokens = getattr(usage, 'prompt_token_count', 0)
        candidates_tokens = getattr(usage, 'candidates_token_count', 0)
        
        logger.debug(
            f"Gemini API call completed. Tokens: {total_tokens} "
            f"(prompt: {prompt_tokens}, response: {candidates_tokens})"
        )
        
        # Estimate cost for logging
        if "gemini-2.5-pro" in model:
            cost = get_cost(ApiType.LLM_GEMINI_2_5_PRO, total_tokens)
        else:
            cost = get_cost(ApiType.LLM_GEMINI_2_5_FLASH, total_tokens)
        
        logger.debug(f"Estimated API call cost: ${cost:.6f}")
    
    return response.text


@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def call_gemini_api(prompt: str, model: Optional[str] = None) -> str:
    """
    Calls the Gemini API with a given prompt and handles retries automatically.
    
    This function includes:
    - Automatic retry logic with exponential backoff (3 attempts)
    - Sentry error tracking for failures
    - Proper logging of API calls and responses
    - Token usage tracking
    
    Args:
        prompt: The full prompt to send to the LLM.
        model: The specific model to use (optional, defaults to LLM_MODEL).
    
    Returns:
        The text response from the LLM.
        
    Raises:
        ValueError: If API key is not configured (not retried).
        Exception: If the API call fails after all retry attempts.
    """
    model_to_use = model or LLM_MODEL
    logger.info(f"Calling Gemini API with model: {model_to_use}")
    
    try:
        result = _call_gemini_api_impl(prompt, model_to_use)
        logger.info("Gemini API call successful")
        return result
        
    except ValueError as e:
        # Configuration error - don't retry, reraise immediately
        logger.error(f"Gemini API configuration error: {e}")
        sentry_sdk.capture_exception(e)
        raise
        
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}", exc_info=True)
        sentry_sdk.capture_exception(e)
        raise
