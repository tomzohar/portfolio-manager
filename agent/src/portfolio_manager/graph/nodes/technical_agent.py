"""
Technical Agent Node for Portfolio Manager.

LangGraph node that performs technical analysis on portfolio positions
using enhanced indicators, trend classification, and volume analysis.
"""

import json
import logging
from typing import Dict, Any, List

import pandas as pd
import sentry_sdk

from ...agent_state import AgentState
from ...config import settings
from ...integrations.polygon import fetch_ohlcv_data
from ...analysis.technical_analyzer import (
    classify_trend,
    detect_support_resistance,
    analyze_volume_patterns,
    calculate_technical_indicators
)
from src.stock_researcher.utils.llm_utils import call_gemini_api

logger = logging.getLogger(__name__)


# System prompt for technical analysis LLM
TECHNICAL_ANALYSIS_SYSTEM_PROMPT = """You are a Senior Technical Analyst specializing in equity markets.

Your task: Analyze the provided technical data and generate actionable timing recommendations.

Assessment Framework:
1. Trend Analysis: Classify current trend strength and direction
2. Entry/Exit Timing: Identify optimal entry/exit points based on indicators
3. Risk Assessment: Evaluate technical risk factors (volatility, support breaks)
4. Recommendation: Buy, Sell, Hold with timing guidance

Output Format (JSON):
{
  "trend_assessment": "Strong Uptrend" | "Weak Uptrend" | "Strong Downtrend" | "Weak Downtrend" | "Sideways",
  "timing_recommendation": "Buy" | "Sell" | "Hold",
  "entry_price": float | null,  // Suggested entry price if recommending Buy
  "stop_loss": float | null,  // Suggested stop-loss level
  "target_price": float | null,  // Suggested profit target
  "rationale": "Brief explanation (2-3 sentences)",
  "key_signals": ["Signal 1", "Signal 2"],  // Key technical signals observed
  "confidence": 0.0-1.0
}

Base your analysis strictly on the provided technical data. Do not speculate beyond the data.
If data is insufficient, state low confidence.
"""


def technical_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node for technical analysis of portfolio positions.
    
    Performs comprehensive technical analysis including:
    - Price trend classification
    - Technical indicator analysis
    - Support/resistance level detection
    - Volume pattern analysis
    - LLM-powered synthesis and timing recommendations
    
    Args:
        state: Current agent state with portfolio tickers
        
    Returns:
        Updated state with technical_analysis field containing:
        {
            "TICKER": {
                "trend": str,
                "indicators": Dict,
                "support_resistance": Dict,
                "volume": Dict,
                "assessment": Dict  # LLM-generated assessment
            },
            ...
        }
        
    Example:
        >>> state = {"portfolio": {"tickers": ["AAPL", "MSFT"]}, "reasoning_trace": []}
        >>> result = technical_agent_node(state)
        >>> print(result["technical_analysis"]["AAPL"]["trend"])
        "Uptrend"
    """
    try:
        # Extract portfolio and tickers (compatible with both dict and Pydantic)
        portfolio = _get_portfolio(state)
        tickers = _get_tickers(portfolio)
        reasoning_trace = _get_reasoning_trace(state)
        
        if not tickers:
            logger.warning("Technical Agent: No tickers to analyze")
            return {
                "technical_analysis": {},
                "reasoning_trace": reasoning_trace + [
                    "Technical Agent: No tickers provided for analysis"
                ]
            }
        
        logger.info(f"Technical Agent: Analyzing {len(tickers)} tickers")
        
        # Analyze each ticker
        analyses = {}
        for ticker in tickers:
            logger.info(f"Technical Agent: Processing {ticker}")
            analysis = _analyze_ticker_technicals(ticker)
            analyses[ticker] = analysis
        
        # Count successful analyses
        successful = sum(1 for a in analyses.values() if a.get("assessment") is not None)
        
        logger.info(f"Technical Agent: Completed {successful}/{len(tickers)} analyses")
        
        return {
            "technical_analysis": analyses,
            "reasoning_trace": reasoning_trace + [
                f"Technical Agent: Analyzed {len(tickers)} positions ({successful} successful)"
            ]
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Technical Agent Error: {e}", exc_info=True)
        reasoning_trace = _get_reasoning_trace(state)
        return {
            "technical_analysis": {},
            "reasoning_trace": reasoning_trace + [
                f"Technical Agent: Failed with error: {str(e)}"
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


def _analyze_ticker_technicals(ticker: str) -> Dict[str, Any]:
    """
    Perform comprehensive technical analysis on a single ticker.
    
    Steps:
    1. Fetch OHLCV data (1 year for sufficient history)
    2. Calculate technical indicators
    3. Classify trend
    4. Detect support/resistance levels
    5. Analyze volume patterns
    6. Call LLM for synthesis and timing recommendation
    7. Parse and structure LLM response
    
    Args:
        ticker: Stock ticker symbol
        
    Returns:
        Dictionary with complete technical analysis:
        {
            "ticker": str,
            "trend": str,
            "indicators": Dict,
            "support_resistance": Dict,
            "volume": Dict,
            "assessment": Dict | None,  # None if LLM fails
            "error": str | None
        }
    """
    try:
        # 1. Fetch price data (1 year)
        logger.info(f"Fetching OHLCV data for {ticker}")
        ohlcv_result = fetch_ohlcv_data([ticker], period="1y")
        
        if not ohlcv_result.get("success"):
            error_msg = ohlcv_result.get("error", "Unknown error")
            logger.error(f"Failed to fetch OHLCV data for {ticker}: {error_msg}")
            return {
                "ticker": ticker,
                "error": f"Data fetch failed: {error_msg}",
                "trend": "Unknown",
                "indicators": {},
                "support_resistance": {"support": [], "resistance": []},
                "volume": {},
                "assessment": None
            }
        
        ohlcv_data = ohlcv_result.get("data", {})
        ohlcv = ohlcv_data.get(ticker, pd.DataFrame())
        
        if ohlcv.empty:
            logger.warning(f"No OHLCV data available for {ticker}")
            return {
                "ticker": ticker,
                "error": "No historical data available",
                "trend": "Unknown",
                "indicators": {},
                "support_resistance": {"support": [], "resistance": []},
                "volume": {},
                "assessment": None
            }
        
        # 2. Calculate technical indicators
        logger.info(f"Calculating indicators for {ticker}")
        indicators = calculate_technical_indicators(ohlcv)
        
        if "error" in indicators:
            logger.warning(f"Indicator calculation failed for {ticker}: {indicators['error']}")
            return {
                "ticker": ticker,
                "error": indicators["error"],
                "trend": "Unknown",
                "indicators": {},
                "support_resistance": {"support": [], "resistance": []},
                "volume": {},
                "assessment": None
            }
        
        # 3. Classify trend using calculated SMAs
        logger.info(f"Classifying trend for {ticker}")
        trend = classify_trend(
            ohlcv,
            sma_50=indicators.get("SMA_50"),
            sma_200=indicators.get("SMA_200")
        )
        
        # 4. Detect support/resistance levels
        logger.info(f"Detecting support/resistance for {ticker}")
        levels = detect_support_resistance(ohlcv, num_levels=3, window=20)
        
        # 5. Analyze volume patterns
        logger.info(f"Analyzing volume patterns for {ticker}")
        volume_analysis = analyze_volume_patterns(ohlcv, window=20)
        
        # 6. LLM synthesis
        logger.info(f"Generating LLM assessment for {ticker}")
        prompt = _build_technical_prompt(
            ticker=ticker,
            ohlcv=ohlcv,
            indicators=indicators,
            trend=trend,
            levels=levels,
            volume_analysis=volume_analysis
        )
        
        try:
            response_text = call_gemini_api(prompt, model=settings.ANALYSIS_MODEL)
            assessment = _parse_technical_assessment(response_text)
        except Exception as llm_error:
            logger.error(f"LLM call failed for {ticker}: {llm_error}")
            sentry_sdk.capture_exception(llm_error)
            assessment = None
        
        # 7. Return structured analysis
        return {
            "ticker": ticker,
            "trend": trend,
            "indicators": indicators,
            "support_resistance": levels,
            "volume": volume_analysis,
            "assessment": assessment,
            "error": None
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Error analyzing {ticker}: {e}", exc_info=True)
        return {
            "ticker": ticker,
            "error": str(e),
            "trend": "Unknown",
            "indicators": {},
            "support_resistance": {"support": [], "resistance": []},
            "volume": {},
            "assessment": None
        }


def _build_technical_prompt(
    ticker: str,
    ohlcv: pd.DataFrame,
    indicators: Dict[str, Any],
    trend: str,
    levels: Dict[str, List[float]],
    volume_analysis: Dict[str, Any]
) -> str:
    """
    Construct LLM prompt for technical analysis.
    
    Args:
        ticker: Stock ticker
        ohlcv: OHLCV DataFrame
        indicators: Dictionary of technical indicators
        trend: Trend classification
        levels: Support/resistance levels
        volume_analysis: Volume pattern analysis
        
    Returns:
        Formatted prompt string
    """
    current_price = float(ohlcv['Close'].iloc[-1])
    
    # Format support/resistance levels
    support_str = ", ".join([f"${s:.2f}" for s in levels.get("support", [])]) or "None detected"
    resistance_str = ", ".join([f"${r:.2f}" for r in levels.get("resistance", [])]) or "None detected"
    
    # Format key indicators
    indicators_str = f"""
    - Current Price: ${current_price:.2f}
    - SMA 50: ${indicators.get('SMA_50', 0):.2f} ({indicators.get('price_vs_SMA50', 'unknown')})
    - SMA 200: ${indicators.get('SMA_200', 0):.2f} ({indicators.get('price_vs_SMA200', 'unknown')})
    - RSI: {indicators.get('RSI', 0):.2f}
    - MACD: {indicators.get('MACD_line', 0):.2f} (Signal: {indicators.get('MACD_signal', 0):.2f})
    - Bollinger Bands: Upper ${indicators.get('BB_upper', 0):.2f}, Lower ${indicators.get('BB_lower', 0):.2f}
    - ATR: ${indicators.get('ATR', 0):.2f}
    - ADX (Trend Strength): {indicators.get('ADX', 0):.2f}
    """
    
    # Format volume analysis
    volume_str = f"""
    - Average Volume: {volume_analysis.get('avg_volume', 0):,.0f}
    - Recent Volume: {volume_analysis.get('recent_volume', 0):,.0f}
    - Volume Spike: {'Yes' if volume_analysis.get('recent_spike') else 'No'}
    - Volume Trend: {volume_analysis.get('trend', 'Unknown')}
    - Volume-Price Correlation: {volume_analysis.get('volume_price_correlation', 0):.2f}
    """
    
    user_prompt = f"""
Analyze the technical setup for {ticker}:

**Trend Classification:** {trend}

**Technical Indicators:**
{indicators_str}

**Support Levels:** {support_str}
**Resistance Levels:** {resistance_str}

**Volume Analysis:**
{volume_str}

Based on this comprehensive technical data, provide your timing recommendation in JSON format.
Focus on:
1. Is the current trend sustainable?
2. Are we near key support/resistance levels?
3. Do volume patterns confirm the price action?
4. What are the optimal entry/exit points?
"""
    
    full_prompt = TECHNICAL_ANALYSIS_SYSTEM_PROMPT + "\n\n" + user_prompt
    return full_prompt


def _parse_technical_assessment(llm_response: str) -> Dict[str, Any]:
    """
    Parse LLM output into structured assessment.
    
    Attempts to extract JSON from LLM response. If JSON parsing fails,
    returns a fallback assessment with low confidence.
    
    Args:
        llm_response: Raw LLM response text
        
    Returns:
        Dictionary with assessment fields:
        {
            "trend_assessment": str,
            "timing_recommendation": str,
            "entry_price": float | None,
            "stop_loss": float | None,
            "target_price": float | None,
            "rationale": str,
            "key_signals": List[str],
            "confidence": float
        }
    """
    try:
        # Try to extract JSON from response
        # LLM might wrap JSON in markdown code blocks
        response_clean = llm_response.strip()
        
        # Remove markdown code blocks if present
        if "```json" in response_clean:
            start = response_clean.find("```json") + 7
            end = response_clean.find("```", start)
            response_clean = response_clean[start:end].strip()
        elif "```" in response_clean:
            start = response_clean.find("```") + 3
            end = response_clean.find("```", start)
            response_clean = response_clean[start:end].strip()
        
        # Parse JSON
        assessment = json.loads(response_clean)
        
        # Validate required fields
        required_fields = ["trend_assessment", "timing_recommendation", "rationale", "confidence"]
        if not all(field in assessment for field in required_fields):
            logger.warning(f"Missing required fields in LLM response: {assessment.keys()}")
            raise ValueError("Missing required fields")
        
        logger.info(f"Successfully parsed technical assessment: {assessment.get('timing_recommendation')}")
        
        # Log confidence for diagnostic purposes
        logger.info(f"Technical LLM returned confidence: {assessment.get('confidence'):.2f}")
        
        return assessment
        
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"Failed to parse LLM response as JSON: {e}")
        logger.debug(f"LLM response: {llm_response[:500]}")
        
        # Fallback: Return conservative assessment
        return {
            "trend_assessment": "Unknown",
            "timing_recommendation": "Hold",
            "entry_price": None,
            "stop_loss": None,
            "target_price": None,
            "rationale": "Unable to parse technical analysis response. Recommend holding position pending further analysis.",
            "key_signals": ["Analysis parsing failed"],
            "confidence": 0.3
        }

