"""
Fundamental Agent Node - Company Valuation Analysis

This module implements a LangGraph node for fundamental analysis using Polygon company data.
The Fundamental Agent assesses intrinsic value and quality of portfolio companies.
"""

from typing import Dict, Any, List
import logging
from ...agent_state import AgentState
from ...integrations.polygon import (
    fetch_ticker_details,
    fetch_financial_statements
)
from src.stock_researcher.utils.llm_utils import call_gemini_api
import sentry_sdk
import json

logger = logging.getLogger(__name__)


def fundamental_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node for fundamental analysis of portfolio positions.
    
    Analyzes company fundamentals using Polygon.io data and LLM reasoning.
    
    Args:
        state: Current agent state with portfolio tickers
        
    Returns:
        Updated state with fundamental_analysis field
    """
    try:
        # Extract portfolio and tickers (compatible with both dict and Pydantic)
        portfolio = _get_portfolio(state)
        tickers = _get_tickers(portfolio)
        reasoning_trace = _get_reasoning_trace(state)
        
        if not tickers:
            logger.warning("Fundamental Agent: No tickers to analyze")
            return {
                "fundamental_analysis": {},
                "reasoning_trace": reasoning_trace + [
                    "Fundamental Agent: No tickers provided"
                ]
            }
        
        logger.info(f"Fundamental Agent: Analyzing {len(tickers)} tickers")
        
        # Analyze each ticker
        analyses = {}
        for ticker in tickers:
            logger.info(f"Analyzing {ticker}")
            analysis = _analyze_ticker_fundamentals(ticker)
            analyses[ticker] = analysis
        
        successful = sum(1 for a in analyses.values() if a.get("success", False))
        logger.info(f"Fundamental Agent: Successfully analyzed {successful}/{len(tickers)} positions")
        
        return {
            "fundamental_analysis": analyses,
            "reasoning_trace": reasoning_trace + [
                f"Fundamental Agent: Analyzed {successful}/{len(tickers)} positions"
            ]
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Fundamental Agent Error: {e}", exc_info=True)
        reasoning_trace = _get_reasoning_trace(state)
        return {
            "fundamental_analysis": {},
            "reasoning_trace": reasoning_trace + [
                f"Fundamental Agent: Failed with error: {str(e)}"
            ]
        }


def _get_portfolio(state: AgentState) -> Dict[str, Any]:
    """Safely extract portfolio from state."""
    if isinstance(state, dict):
        return state.get("portfolio", {})
    else:
        return state.portfolio if state.portfolio else {}


def _get_tickers(portfolio: Any) -> List[str]:
    """Safely extract tickers from portfolio."""
    if isinstance(portfolio, dict):
        return portfolio.get("tickers", [])
    elif hasattr(portfolio, 'tickers'):
        return portfolio.tickers
    else:
        return []


def _get_reasoning_trace(state: AgentState) -> List[str]:
    """Safely extract reasoning_trace from state."""
    if isinstance(state, dict):
        return state.get("reasoning_trace", [])
    else:
        return state.reasoning_trace if state.reasoning_trace else []


def _analyze_ticker_fundamentals(ticker: str) -> Dict[str, Any]:
    """
    Perform fundamental analysis on a single ticker.
    
    Steps:
    1. Fetch company details from Polygon (market cap, sector, description)
    2. Fetch financial statements if available
    3. Compute derived metrics (growth rates, ratios)
    4. Call LLM for qualitative assessment
    5. Return structured analysis
    
    Args:
        ticker: Stock ticker symbol
        
    Returns:
        Dictionary with fundamental analysis results
    """
    try:
        # 1. Fetch company data
        fundamentals = fetch_ticker_details(ticker)
        
        if not fundamentals.get("success"):
            logger.warning(f"Failed to fetch fundamentals for {ticker}")
            return {
                "success": False,
                "ticker": ticker,
                "error": fundamentals.get("error", "Unknown error")
            }
        
        # 2. Fetch financial statements (may not be available in subscription)
        statements = fetch_financial_statements(ticker, limit=4)
        
        # 3. Compute metrics
        metrics = _compute_fundamental_metrics(fundamentals, statements)
        
        # 4. LLM analysis using centralized utility
        prompt = _build_fundamental_prompt(ticker, fundamentals, metrics, statements)
        response_text = call_gemini_api(prompt, model='gemini-2.5-flash')
        
        # 5. Parse assessment
        assessment = _parse_fundamental_assessment(response_text)
        
        logger.info(
            f"{ticker}: {assessment['valuation']} | "
            f"Quality: {assessment['quality_score']}/10 | "
            f"Rec: {assessment['recommendation']}"
        )
        
        return {
            "success": True,
            "ticker": ticker,
            "fundamentals": fundamentals,
            "metrics": metrics,
            "statements_available": statements.get("success", False),
            "assessment": assessment
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Error analyzing {ticker}: {e}", exc_info=True)
        return {
            "success": False,
            "ticker": ticker,
            "error": str(e)
        }


def _compute_fundamental_metrics(fundamentals: Dict, statements: Dict) -> Dict[str, Any]:
    """
    Compute financial metrics from raw data.
    
    Metrics:
    1. Revenue Growth (QoQ, YoY if available)
    2. Net Income Margin
    3. Debt-to-Assets Ratio
    4. Operating Cash Flow trend
    
    Args:
        fundamentals: Ticker details from Polygon
        statements: Financial statements (may be unavailable)
        
    Returns:
        Dictionary of computed metrics
    """
    metrics = {"available": False}
    
    # Check if detailed financials are available
    if not statements.get("success") or not statements.get("statements"):
        logger.info("Detailed financials unavailable, using basic metrics")
        return {
            "available": False,
            "market_cap": fundamentals.get("market_cap"),
            "sector": fundamentals.get("sector"),
            "note": "Detailed financial statements not available in subscription tier"
        }
    
    stmts = statements["statements"]
    metrics["available"] = True
    
    try:
        # Revenue growth (most recent quarter vs. previous)
        if len(stmts) >= 2:
            recent_rev = stmts[0].get("revenue")
            prev_rev = stmts[1].get("revenue")
            if recent_rev and prev_rev and prev_rev != 0:
                metrics["revenue_growth_qoq"] = ((recent_rev - prev_rev) / prev_rev) * 100
            else:
                metrics["revenue_growth_qoq"] = None
        
        # Net Income Margin
        latest = stmts[0]
        if latest.get("revenue") and latest.get("net_income") and latest["revenue"] != 0:
            metrics["net_income_margin"] = (latest["net_income"] / latest["revenue"]) * 100
        else:
            metrics["net_income_margin"] = None
        
        # Debt-to-Assets
        if latest.get("total_assets") and latest.get("total_liabilities") and latest["total_assets"] != 0:
            metrics["debt_to_assets"] = (latest["total_liabilities"] / latest["total_assets"]) * 100
        else:
            metrics["debt_to_assets"] = None
        
        # Operating Cash Flow trend
        if len(stmts) >= 2:
            recent_ocf = stmts[0].get("operating_cash_flow")
            prev_ocf = stmts[-1].get("operating_cash_flow")
            if recent_ocf and prev_ocf:
                metrics["ocf_trend"] = "Improving" if recent_ocf > prev_ocf else "Declining"
            else:
                metrics["ocf_trend"] = "Unknown"
        
        # EPS (Earnings Per Share)
        metrics["eps"] = latest.get("eps")
        
    except (KeyError, TypeError, ZeroDivisionError) as e:
        logger.warning(f"Error computing metrics: {e}")
    
    return metrics


def _build_fundamental_prompt(
    ticker: str, 
    fundamentals: Dict, 
    metrics: Dict,
    statements: Dict
) -> str:
    """
    Construct LLM prompt for fundamental analysis.
    
    Args:
        ticker: Stock ticker
        fundamentals: Company details
        metrics: Computed metrics
        statements: Financial statements result
        
    Returns:
        Formatted prompt string
    """
    system_prompt = """You are a Senior Equity Analyst specializing in fundamental analysis.

Your task: Assess the valuation and quality of a company based on provided fundamentals.

Assessment Framework:
1. Valuation: Undervalued, Fair, Overvalued (based on market cap, sector, growth)
2. Quality Score (0-10): Profitability, leverage, cash flow
3. Recommendation: Buy, Hold, Sell

Output Format (JSON):
{
  "valuation": "Undervalued" | "Fair" | "Overvalued",
  "quality_score": 0-10,
  "recommendation": "Buy" | "Hold" | "Sell",
  "rationale": "Brief explanation (2-3 sentences)",
  "key_risks": ["Risk 1", "Risk 2"],
  "confidence": 0.0-1.0
}

Base your analysis on data, not speculation. If data is insufficient, state low confidence."""

    # Build user prompt with available data
    description = fundamentals.get("description", "N/A")
    if description and len(description) > 300:
        description = description[:300] + "..."
    
    market_cap = fundamentals.get("market_cap")
    market_cap_str = f"${market_cap:,.0f}" if market_cap else "N/A"
    
    user_prompt = f"""Analyze {ticker} fundamentals:

Company: {description}
Sector: {fundamentals.get('sector', 'N/A')}
Market Cap: {market_cap_str}
Shares Outstanding: {fundamentals.get('shares_outstanding', 'N/A'):,}
"""

    # Add financial metrics if available
    if metrics.get("available"):
        user_prompt += f"""
Financial Metrics (Latest Quarter):
Revenue Growth (QoQ): {metrics.get('revenue_growth_qoq', 'N/A')}%
Net Income Margin: {metrics.get('net_income_margin', 'N/A')}%
Debt-to-Assets: {metrics.get('debt_to_assets', 'N/A')}%
Operating Cash Flow Trend: {metrics.get('ocf_trend', 'N/A')}
EPS: {metrics.get('eps', 'N/A')}
"""
    else:
        user_prompt += f"""
Note: {metrics.get('note', 'Detailed financial statements not available')}
Analysis limited to basic company information.
"""

    user_prompt += "\nProvide your assessment in JSON format."

    return f"{system_prompt}\n\n{user_prompt}"


def _parse_fundamental_assessment(llm_response: str) -> Dict:
    """
    Parse LLM output into structured assessment.
    
    Args:
        llm_response: Raw LLM response string
        
    Returns:
        Dictionary with parsed assessment
    """
    try:
        # Extract JSON from response
        response_clean = llm_response.strip()
        
        # Handle markdown code blocks
        if "```json" in response_clean:
            start = response_clean.find("```json") + 7
            end = response_clean.find("```", start)
            response_clean = response_clean[start:end].strip()
        elif "```" in response_clean:
            start = response_clean.find("```") + 3
            end = response_clean.find("```", start)
            response_clean = response_clean[start:end].strip()
        
        # Parse JSON
        data = json.loads(response_clean)
        
        # Validate and return
        assessment = {
            "valuation": data.get("valuation", "Fair"),
            "quality_score": int(data.get("quality_score") or 5),  # Handle None explicitly
            "recommendation": data.get("recommendation", "Hold"),
            "rationale": data.get("rationale", "Unable to assess"),
            "key_risks": data.get("key_risks", []),
            "confidence": float(data.get("confidence") or 0.5)  # Handle None explicitly
        }
        
        return assessment
        
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        sentry_sdk.capture_exception(e)
        logger.warning(f"Failed to parse LLM response, using conservative default: {e}")
        
        # Fallback to conservative assessment
        return {
            "valuation": "Fair",
            "quality_score": 5,
            "recommendation": "Hold",
            "rationale": "Unable to parse analysis, defaulting to hold recommendation",
            "key_risks": ["Data parsing error"],
            "confidence": 0.3
        }

