#!/usr/bin/env python3
"""
Technical Analyst Agent
Fetches historical stock data and uses an LLM to generate a technical analysis summary.
"""

import json
from typing import List, Dict
import pandas as pd
from ..data_fetcher.ohlcv import fetch_ohlcv_data
from ..utils.llm_utils import call_gemini_api, LLM_MODEL

SYSTEM_INSTRUCTION = (
    "You are an expert Technical Analyst. Your task is to analyze the provided daily stock data "
    "for the past year and generate a concise technical summary. Identify the primary trend "
    "(e.g., uptrend, downtrend, sideways), comment on recent momentum, and state whether the stock "
    "appears overbought or oversold. Provide a 1-2 sentence summary of the stock's technical health "
    "and suggest potential entry or exit points based purely on this technical data. Keep your "
    "entire analysis to a maximum of 2-3 sentences."
)

def analyze_stock_technicals(tickers: List[str]) -> Dict[str, str]:
    """
    Analyzes the technical health of stocks based on their historical data.

    Args:
        tickers: A list of stock ticker symbols.

    Returns:
        A dictionary where keys are ticker symbols and values are the LLM-generated
        technical analysis summaries.
    """
    print(f"\n[Agent 4] Analyzing technicals for {len(tickers)} stocks using {LLM_MODEL}...")
    
    # 1. Fetch historical data
    ohlcv_data = fetch_ohlcv_data(tickers, period="1y")
    
    technical_summaries = {}
    
    for ticker, df in ohlcv_data.items():
        if df.empty:
            technical_summaries[ticker] = "No data available for technical analysis."
            continue
        
        # 2. Format data for the LLM
        # Convert the DataFrame to a more compact JSON format for the prompt
        df_json = df[['Open', 'High', 'Low', 'Close', 'Volume']].to_json(orient="index", date_format="iso")
        
        # 3. Create the prompt
        user_prompt = f"""
        **Stock Data for {ticker}:**
        ```json
        {df_json}
        ```
        """
        
        full_prompt = SYSTEM_INSTRUCTION + "\n\n" + user_prompt
        
        # 4. Call the LLM for analysis
        try:
            print(f"  -> Generating technical analysis for {ticker}...")
            summary = call_gemini_api(full_prompt, model='gemini-2.5-flash')
            technical_summaries[ticker] = summary.strip()
        except Exception as e:
            print(f"  -> Failed to generate technical analysis for {ticker}: {e}")
            technical_summaries[ticker] = "Technical analysis failed due to an API error."
            
    return technical_summaries
