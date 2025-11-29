"""
Analyze Technicals Tool

This tool calculates and interprets technical indicators (RSI, MACD, SMA) for
specified stock tickers using historical OHLCV data.

Technical analysis provides quantitative insights about price momentum, trends,
and potential reversal points, complementing the fundamental analysis from news.

Author: Portfolio Manager Agent
Version: 1.0.0
"""

from typing import List, Dict, Any
import logging

from ..analysis.technical_analyzer import analyze_stock_technicals
from ..agent_state import ToolResult
from ..tool_registry import tool
from ..utils import ApiType

logger = logging.getLogger(__name__)


@tool(
    name="analyze_technicals",
    description="Calculates and analyzes technical indicators (RSI, MACD, SMA) for specific tickers using 1 year of historical data.",
    parameters={
        "tickers": {
            "type": "List[str]",
            "description": "List of stock ticker symbols to analyze",
            "required": True
        }
    },
    examples=[
        '{"tool": "analyze_technicals", "args": {"tickers": ["AAPL", "NVDA"]}}'
    ]
)
def analyze_technicals_tool(tickers: List[str]) -> ToolResult:
    """
    Analyze Technical Indicators Tool
    
    Fetches 1 year of historical OHLCV data and calculates key technical
    indicators, then generates AI-powered interpretations.
    
    **Data Flow:**
    1. Fetches historical data (Polygon API)
       - 1 year of daily OHLCV data
       - Open, High, Low, Close, Volume
    
    2. Calculates indicators (pandas-ta)
       - SMA (50-day and 200-day moving averages)
       - RSI (Relative Strength Index - 14 period)
       - MACD (Moving Average Convergence Divergence)
    
    3. Generates LLM analysis (Gemini Flash)
       - Concurrent processing (2 workers)
       - Identifies primary trend
       - Comments on momentum
       - Assesses overbought/oversold conditions
       - 2-3 sentence technical health summary
    
    **Args:**
        tickers: List of stock ticker symbols (e.g., ["AAPL", "NVDA"])
                 Max recommended: 20 tickers per call
    
    **Returns:**
        ToolResult with:
        - success: True if analysis completed
        - data: Dict[str, str] mapping ticker to analysis summary
            Example: {
                "AAPL": "Stock shows bullish momentum with RSI at 65. 
                        Price above 50-day SMA indicates uptrend. 
                        MACD positive suggests continued strength."
            }
        - error: None on success, error message on failure
        - confidence_impact: 0.2 (technical indicators add solid confidence)
    
    **Example:**
        >>> result = analyze_technicals_tool(tickers=["MSFT", "GOOGL"])
        >>> if result.success:
        ...     for ticker, analysis in result.data.items():
        ...         print(f"{ticker}: {analysis}")
    
    **Error Handling:**
        - Polygon API failures (rate limits, network issues)
        - Insufficient historical data (new IPOs)
        - LLM API failures
        - Calculation errors (division by zero, NaN values)
        
        Per-ticker failures are handled gracefully with error messages
        for that ticker; other tickers continue processing.
    
    **Performance:**
        - Typical execution: 8-15 seconds for 3 tickers
        - Concurrent data fetch and LLM processing
        - Network-dependent (Polygon API + Gemini API)
    
    **Cost:**
        - Polygon API: Free tier with rate limits
        - Gemini Flash: ~$0.001 per analysis
        - Total: ~$0.001-$0.003 per ticker
    
    **Technical Indicators Calculated:**
        - **SMA 50/200**: Trend identification
        - **RSI**: Overbought (>70) / Oversold (<30)
        - **MACD**: Momentum and potential reversals
    
    **Side Effects:**
        - API calls to Polygon and Google Gemini
        - Logs info/error messages
        - No state modifications
    
    **Notes:**
        - Requires 1 year of trading history
        - New IPOs may have insufficient data
        - Weekend/holiday data may be stale
        - Indicators are lagging by nature
    """
    try:
        logger.info(f"Tool invoked: analyze_technicals for tickers: {tickers}")
        
        if not tickers:
            logger.warning("No tickers provided for technical analysis")
            return ToolResult(
                success=True,
                data={},
                error=None,
                confidence_impact=0.0,
            )
        
        # Use the legacy function to analyze technicals
        technical_summaries = analyze_stock_technicals(tickers)
        
        logger.info(f"Technical analysis completed for {len(technical_summaries)} tickers")
        
        # Report API calls for cost tracking
        api_calls = [
            {"api_type": ApiType.POLYGON_API.value, "count": 1},
            {"api_type": ApiType.LLM_GEMINI_2_5_FLASH.value, "count": len(technical_summaries)},
        ]
        
        # NEW: Construct the state_patch
        state_patch = {
            "analysis_results": {
                ticker: {"technicals": summary} for ticker, summary in technical_summaries.items()
            }
        }
        
        return ToolResult(
            success=True,
            data=technical_summaries,
            error=None,
            confidence_impact=0.2,  # Technical indicators add solid confidence
            state_patch=state_patch,
            api_calls=api_calls,
        )
    
    except Exception as e:
        logger.error(f"Failed to analyze technicals for {tickers}: {str(e)}", exc_info=True)
        return ToolResult(
            success=False,
            data={},
            error=f"Technical analysis failed: {str(e)}",
            confidence_impact=-0.1,  # Partial failure
        )

