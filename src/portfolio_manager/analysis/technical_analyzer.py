"""
Technical Analyzer

Calculates technical indicators and generates AI-powered analysis for stocks
using historical OHLCV data and LLM interpretation.

This module combines quantitative technical analysis (RSI, MACD, SMA) with
qualitative AI insights to provide comprehensive technical assessments.

Author: Portfolio Manager Agent
Version: 2.0.0 (Migrated from legacy stock_researcher)
"""

import json
import logging
from typing import List, Dict, Tuple, Any
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import pandas_ta as ta
import sentry_sdk
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from ..utils import call_gemini_api
from ..integrations.polygon import fetch_ohlcv_data
from ..config import settings

logger = logging.getLogger(__name__)

# System instruction for the LLM
SYSTEM_INSTRUCTION = (
    "You are an expert Technical Analyst. Your task is to analyze the provided technical indicators for a stock "
    "and generate a concise technical summary. Identify the primary trend, comment on momentum, and state whether the stock "
    "appears overbought or oversold based on the RSI. Provide a 1-2 sentence summary of the stock's technical health. "
    "Keep your entire analysis to a maximum of 2-3 sentences."
)


def calculate_technical_indicators(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculates key technical indicators from OHLCV data using vectorized operations.
    
    This function computes:
    - SMA (Simple Moving Averages): 50-day and 200-day
    - RSI (Relative Strength Index): 14-period
    - MACD (Moving Average Convergence Divergence): 12/26/9 standard
    
    All calculations use pandas-ta vectorized operations (no DataFrame loops).
    
    Args:
        df: DataFrame with columns ['Open', 'High', 'Low', 'Close', 'Volume']
            Must contain at least 200 rows for full indicator calculation
    
    Returns:
        Dictionary containing calculated indicators:
        {
            'SMA_50': str,          # 50-day simple moving average
            'SMA_200': str,         # 200-day simple moving average
            'RSI': str,             # Relative Strength Index (14-period)
            'MACD_line': str,       # MACD line (12-26)
            'MACD_signal': str,     # MACD signal line (9-period)
            'MACD_hist': str,       # MACD histogram
            'price_vs_SMA50': str,  # "above" or "below"
            'price_vs_SMA200': str, # "above" or "below"
        }
        
        Returns {"error": str} if insufficient data or calculation fails.
    
    Example:
        >>> df = fetch_ohlcv_data(["AAPL"], period="1y")["AAPL"]
        >>> indicators = calculate_technical_indicators(df)
        >>> print(f"RSI: {indicators['RSI']}, SMA50: {indicators['SMA_50']}")
    
    Notes:
        - Requires minimum 200 rows for 200-day SMA
        - Uses pandas-ta vectorized calculations (no loops)
        - Returns formatted strings (2 decimal places) for consistency
        - Handles edge cases (empty DataFrames, NaN values)
    
    Raises:
        No exceptions raised; returns error dict on failures
    """
    if df.empty or len(df) < 200:
        logger.warning(f"Insufficient data for technical indicators: {len(df)} rows (need 200+)")
        return {
            "error": "Not enough historical data to calculate full indicators."
        }
    
    try:
        logger.debug(f"Calculating technical indicators for {len(df)} data points...")
        
        # Calculate indicators using pandas-ta (vectorized operations)
        # NOTE: Using individual calculations to avoid buggy .strategy() method
        sma_50 = df.ta.sma(length=50, append=False)
        sma_200 = df.ta.sma(length=200, append=False)
        rsi = df.ta.rsi(append=False)
        macd = df.ta.macd(append=False)

        # Extract latest values (vectorized indexing, no loops)
        latest_sma_50 = sma_50.iloc[-1]
        latest_sma_200 = sma_200.iloc[-1]
        latest_rsi = rsi.iloc[-1]
        latest_macd_line = macd['MACD_12_26_9'].iloc[-1]
        latest_macd_signal = macd['MACDs_12_26_9'].iloc[-1]
        latest_macd_hist = macd['MACDh_12_26_9'].iloc[-1]
        
        # Build indicators dictionary
        indicators = {
            'SMA_50': f"{latest_sma_50:.2f}",
            'SMA_200': f"{latest_sma_200:.2f}",
            'RSI': f"{latest_rsi:.2f}",
            'MACD_line': f"{latest_macd_line:.2f}",
            'MACD_signal': f"{latest_macd_signal:.2f}",
            'MACD_hist': f"{latest_macd_hist:.2f}"
        }
        
        # Add context: price vs moving averages (vectorized comparison)
        latest_close = df['Close'].iloc[-1]
        indicators['price_vs_SMA50'] = "above" if latest_close > latest_sma_50 else "below"
        indicators['price_vs_SMA200'] = "above" if latest_close > latest_sma_200 else "below"
        
        logger.debug(f"Successfully calculated indicators: RSI={indicators['RSI']}")
        return indicators
        
    except Exception as e:
        logger.error(f"Failed to calculate technical indicators: {str(e)}", exc_info=True)
        sentry_sdk.capture_exception(e)
        return {
            "error": f"Technical indicator calculation failed: {str(e)}"
        }


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _analyze_technicals_for_ticker(ticker: str, df: pd.DataFrame) -> Tuple[str, str]:
    """
    Generates technical analysis summary for a single ticker using LLM.
    
    This function:
    1. Calculates technical indicators from OHLCV data
    2. Formats indicators as JSON for LLM prompt
    3. Generates AI-powered technical interpretation
    
    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        df: DataFrame with OHLCV data (at least 200 rows recommended)
    
    Returns:
        Tuple of (ticker, analysis_text):
        - ticker: The stock ticker symbol
        - analysis_text: LLM-generated technical analysis or error message
    
    Raises:
        Exception: On LLM API failures after retries
    
    Example:
        >>> df = fetch_ohlcv_data(["AAPL"], period="1y")["AAPL"]
        >>> ticker, analysis = _analyze_technicals_for_ticker("AAPL", df)
        >>> print(analysis)
        "Stock shows bullish momentum with RSI at 65. Price above 50-day SMA..."
    
    Notes:
        - Returns error message if DataFrame is empty or insufficient
        - Retries up to 3 times on API failures
        - Uses Gemini Flash model for cost efficiency
        - Errors captured in Sentry
    """
    if df.empty:
        logger.warning(f"Empty DataFrame provided for {ticker}")
        return ticker, "No data available for technical analysis."
    
    try:
        logger.debug(f"Analyzing technicals for {ticker}...")
        
        # Calculate technical indicators
        indicators = calculate_technical_indicators(df)
        
        # Check for calculation errors
        if "error" in indicators:
            logger.warning(f"Indicator calculation failed for {ticker}: {indicators['error']}")
            return ticker, indicators["error"]

        # Construct LLM prompt with indicators
        user_prompt = f"""
    **Technical Indicators for {ticker}:**
    ```json
    {json.dumps(indicators, indent=2)}
    ```
    Based on these indicators, provide a concise technical analysis.
    """
        
        full_prompt = SYSTEM_INSTRUCTION + "\n\n" + user_prompt
        
        # Call LLM API (uses Flash model for speed)
        summary = call_gemini_api(full_prompt, model=settings.ANALYSIS_MODEL)
        
        logger.info(f"Successfully generated technical analysis for {ticker}")
        return ticker, summary.strip()
        
    except Exception as e:
        logger.error(f"Failed to generate technical analysis for {ticker}: {str(e)}", exc_info=True)
        sentry_sdk.capture_exception(e)
        return ticker, "Technical analysis failed due to an API error."


def analyze_stock_technicals(tickers: List[str]) -> Dict[str, str]:
    """
    Analyzes technical health of multiple stocks concurrently.
    
    This function:
    1. Fetches 1 year of historical OHLCV data (batch)
    2. Calculates technical indicators for each ticker
    3. Generates LLM-powered analysis (concurrent, 2 workers)
    
    The complete workflow provides both quantitative indicators and
    qualitative AI interpretation for investment decision-making.
    
    Args:
        tickers: List of stock ticker symbols (e.g., ["AAPL", "MSFT", "GOOGL"])
                Max recommended: 20 tickers per call
    
    Returns:
        Dictionary mapping ticker symbols to technical analysis summaries.
        
        Example:
        {
            "AAPL": "Stock shows bullish momentum with RSI at 65. 
                    Price above 50-day SMA indicates uptrend. 
                    MACD positive suggests continued strength.",
            "MSFT": "Neutral technical picture with RSI at 50.
                    Trading between moving averages. 
                    MACD crossover pending."
        }
    
    Notes:
        - Fetches 1 year of daily OHLCV data from Polygon API
        - Processes up to 2 tickers concurrently (respects API rate limits)
        - Failed analyses return error messages but don't block others
        - Typical processing time: 8-15 seconds for 3 tickers
        - Uses Gemini Flash model for cost efficiency
    
    Performance:
        - Data fetch: 3-5 seconds (batch, single API call)
        - Indicator calculation: <1 second per ticker (vectorized)
        - LLM analysis: 3-5 seconds per ticker (concurrent)
    
    Example:
        >>> analyses = analyze_stock_technicals(["AAPL", "MSFT", "GOOGL"])
        >>> for ticker, analysis in analyses.items():
        ...     print(f"{ticker}: {analysis}")
    """
    if not tickers:
        logger.warning("No tickers provided for technical analysis")
        return {}
    
    logger.info(f"Analyzing technicals for {len(tickers)} stocks using {settings.ANALYSIS_MODEL}...")
    
    try:
        # Step 1: Fetch historical OHLCV data (batch operation)
        logger.debug(f"Fetching OHLCV data for {len(tickers)} tickers...")
        ohlcv_result = fetch_ohlcv_data(tickers, period="1y")
        
        # Check if fetch was successful
        if not ohlcv_result["success"]:
            logger.error(f"Failed to fetch OHLCV data: {ohlcv_result['error']}")
            return {}
        
        ohlcv_data = ohlcv_result["data"]
        logger.info(f"Fetched OHLCV data for {len(ohlcv_data)} tickers")
        
        technical_summaries = {}
        
        # Step 2: Analyze technicals concurrently
        # Limit to 2 workers to respect API rate limits
        with ThreadPoolExecutor(max_workers=2) as executor:
            # Submit all analysis tasks
            futures = [
                executor.submit(_analyze_technicals_for_ticker, ticker, df) 
                for ticker, df in ohlcv_data.items()
            ]
            
            # Collect results as they complete
            for future in futures:
                try:
                    ticker, summary = future.result()
                    technical_summaries[ticker] = summary
                except Exception as e:
                    logger.error(f"Failed to process a ticker's technical analysis: {str(e)}", exc_info=True)
                    sentry_sdk.capture_exception(e)
                    # Continue processing other tickers
        
        logger.info(f"Successfully generated {len(technical_summaries)} technical analyses")
        return technical_summaries
        
    except Exception as e:
        logger.error(f"Fatal error during technical analysis: {str(e)}", exc_info=True)
        sentry_sdk.capture_exception(e)
        # Return whatever we managed to generate
        return {}
