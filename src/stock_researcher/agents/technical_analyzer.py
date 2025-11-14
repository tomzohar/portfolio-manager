#!/usr/bin/env python3
"""
Technical Analyst Agent
Fetches historical stock data and uses an LLM to generate a technical analysis summary.
"""

import json
from typing import List, Dict, Tuple
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
from ..data_fetcher.ohlcv import fetch_ohlcv_data
from ..utils.llm_utils import call_gemini_api, LLM_MODEL
from ..utils.technical_analysis_utils import calculate_technical_indicators

SYSTEM_INSTRUCTION = (
    "You are an expert Technical Analyst. Your task is to analyze the provided technical indicators for a stock "
    "and generate a concise technical summary. Identify the primary trend, comment on momentum, and state whether the stock "
    "appears overbought or oversold based on the RSI. Provide a 1-2 sentence summary of the stock's technical health. "
    "Keep your entire analysis to a maximum of 2-3 sentences."
)

def _analyze_technicals_for_ticker(ticker: str, df: pd.DataFrame) -> Tuple[str, str]:
    """Generates a technical analysis summary for a single stock ticker."""
    if df.empty:
        return ticker, "No data available for technical analysis."
    
    # 1. Calculate technical indicators
    indicators = calculate_technical_indicators(df)
    
    if "error" in indicators:
        return ticker, indicators["error"]

    # 2. Create the prompt with the indicators
    user_prompt = f"""
    **Technical Indicators for {ticker}:**
    ```json
    {json.dumps(indicators, indent=2)}
    ```
    Based on these indicators, provide a concise technical analysis.
    """
    
    full_prompt = SYSTEM_INSTRUCTION + "\n\n" + user_prompt
    
    try:
        print(f"  -> Generating technical analysis for {ticker}...")
        summary = call_gemini_api(full_prompt, model='gemini-2.5-flash')
        return ticker, summary.strip()
    except Exception as e:
        print(f"  -> Failed to generate technical analysis for {ticker}: {e}")
        return ticker, "Technical analysis failed due to an API error."

def analyze_stock_technicals(tickers: List[str]) -> Dict[str, str]:
    """
    Analyzes the technical health of stocks based on their historical data concurrently.

    Args:
        tickers: A list of stock ticker symbols.

    Returns:
        A dictionary where keys are ticker symbols and values are the LLM-generated
        technical analysis summaries.
    """
    print(f"\n[Agent 4] Analyzing technicals for {len(tickers)} stocks using {LLM_MODEL}...")
    
    # 1. Fetch historical data in a batch
    ohlcv_data = fetch_ohlcv_data(tickers, period="1y")
    
    technical_summaries = {}
    
    # 2. Analyze technicals concurrently, limiting concurrency to 2
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(_analyze_technicals_for_ticker, ticker, df) 
                   for ticker, df in ohlcv_data.items()]
        
        for future in futures:
            ticker, summary = future.result()
            technical_summaries[ticker] = summary
            
    return technical_summaries
