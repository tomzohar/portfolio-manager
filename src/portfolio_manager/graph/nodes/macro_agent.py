"""
Macro Agent Node - Market Regime Analysis

This module implements a LangGraph node for macroeconomic analysis using FRED data.
The Macro Agent classifies market regimes and determines risk sentiment.
"""

from typing import Dict, Any
import logging
from ...agent_state import AgentState
from ...schemas import MarketRegime
from ...integrations.fred import (
    get_latest_cpi_yoy,
    get_latest_gdp_growth,
    get_yield_curve_spread,
    get_vix,
    get_unemployment_rate
)
from src.stock_researcher.utils.llm_utils import call_gemini_api
import sentry_sdk
import json
from datetime import datetime

logger = logging.getLogger(__name__)


def macro_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node for macroeconomic analysis.
    
    Fetches economic indicators from FRED and uses LLM to classify
    market regime and risk sentiment.
    
    Args:
        state: Current agent state
        
    Returns:
        Updated state with macro_analysis field
    """
    try:
        logger.info("Macro Agent: Fetching economic data")
        
        # 1. Fetch economic data
        macro_data = _fetch_macro_indicators()
        
        if not macro_data or not macro_data.get("available"):
            logger.warning("Macro Agent: Economic data unavailable")
            return {
                "macro_analysis": None,
                "scratchpad": state.get("scratchpad", []) + [
                    "Macro Agent: Economic data unavailable, skipping macro analysis"
                ]
            }
        
        logger.info(f"Macro Data: CPI={macro_data['cpi_yoy']:.1f}%, GDP={macro_data['gdp_growth']:.1f}%, VIX={macro_data['vix']:.1f}")
        
        # 2. Build LLM prompt
        prompt = _build_macro_analysis_prompt(macro_data)
        
        # 3. Call LLM using centralized utility
        response_text = call_gemini_api(prompt, model='gemini-2.5-flash')
        
        # 4. Parse response into MarketRegime schema
        regime = _parse_market_regime(response_text)
        
        logger.info(f"Market Regime: {regime.status}, Signal: {regime.signal}")
        
        # 5. Update state
        return {
            "macro_analysis": regime.model_dump(),
            "scratchpad": state.get("scratchpad", []) + [
                f"Macro Agent: Market regime = {regime.status}, signal = {regime.signal}"
            ]
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Macro Agent Error: {e}", exc_info=True)
        return {
            "macro_analysis": None,
            "scratchpad": state.get("scratchpad", []) + [
                f"Macro Agent: Failed with error: {str(e)}"
            ]
        }


def _fetch_macro_indicators() -> Dict[str, Any]:
    """
    Fetch all required economic indicators from FRED.
    
    Returns:
        Dictionary with macro indicators or None if unavailable
    """
    try:
        indicators = {
            "available": True,
            "cpi_yoy": get_latest_cpi_yoy(),
            "gdp_growth": get_latest_gdp_growth(),
            "yield_spread": get_yield_curve_spread(),
            "vix": get_vix(),
            "unemployment": get_unemployment_rate(),
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        
        # Check if any critical indicators are None
        if indicators["cpi_yoy"] is None or indicators["gdp_growth"] is None:
            logger.warning("Critical economic indicators unavailable")
            return {"available": False}
        
        return indicators
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Error fetching macro indicators: {e}", exc_info=True)
        return {"available": False}


def _build_macro_analysis_prompt(macro_data: Dict) -> str:
    """
    Construct LLM prompt with macro data.
    
    Args:
        macro_data: Dictionary of economic indicators
        
    Returns:
        Formatted prompt string
    """
    system_prompt = """You are a Senior Macroeconomic Analyst specializing in market regime classification.

Your task: Analyze the provided economic indicators and classify the current market regime.

Available Regimes:
1. Inflationary - Rising CPI (>3% YoY), favors real assets
2. Deflationary - Falling GDP + rising unemployment, favors bonds/cash
3. Goldilocks - Moderate growth + low inflation, favors growth stocks

Risk Signals:
- Risk-On: VIX < 20, positive yield curve, low unemployment
- Risk-Off: VIX > 20, inverted yield curve, rising unemployment

Output Format (JSON):
{
  "status": "Inflationary" | "Deflationary" | "Goldilocks",
  "signal": "Risk-On" | "Risk-Off",
  "key_driver": "Brief explanation of primary macro factor",
  "confidence": 0.0-1.0
}

Be concise, data-driven, and avoid speculation."""

    user_prompt = f"""Analyze the current market regime based on these indicators:

CPI (YoY): {macro_data['cpi_yoy']:.2f}%
GDP Growth (QoQ): {macro_data['gdp_growth']:.2f}%
Yield Curve (10Y-2Y): {macro_data['yield_spread']:.2f} bps
VIX: {macro_data['vix']:.2f}
Unemployment: {macro_data['unemployment']:.2f}%

Date: {macro_data['date']}

Provide your analysis in JSON format."""

    return f"{system_prompt}\n\n{user_prompt}"


def _parse_market_regime(llm_response: str) -> MarketRegime:
    """
    Parse LLM output into structured MarketRegime schema.
    
    Args:
        llm_response: Raw LLM response string
        
    Returns:
        MarketRegime Pydantic model
        
    Raises:
        ValueError: If parsing fails
    """
    try:
        # Try to extract JSON from response
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
        
        # Create and validate MarketRegime
        regime = MarketRegime(
            status=data["status"],
            signal=data["signal"],
            key_driver=data["key_driver"],
            confidence=float(data.get("confidence", 0.8))
        )
        
        return regime
        
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        sentry_sdk.capture_exception(e)
        logger.warning(f"Failed to parse LLM response, using conservative default: {e}")
        
        # Fallback to conservative regime
        return MarketRegime(
            status="Goldilocks",
            signal="Risk-Off",
            key_driver="Unable to parse economic data, defaulting to conservative stance",
            confidence=0.3
        )

