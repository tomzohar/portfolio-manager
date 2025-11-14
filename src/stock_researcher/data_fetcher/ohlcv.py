#!/usr/bin/env python3
"""
OHLCV Data Fetcher
Fetches historical Open, High, Low, Close, and Volume data for stocks.
"""

import yfinance as yf
import pandas as pd
from typing import List, Dict
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def _fetch_ohlcv_batch(tickers: List[str], period: str):
    """Fetches OHLCV data in a batch with retry logic."""
    return yf.download(tickers, period=period, progress=False, group_by='ticker')

def fetch_ohlcv_data(tickers: List[str], period: str = "1y") -> Dict[str, pd.DataFrame]:
    """
    Fetches historical OHLCV data for a list of stock tickers.

    Args:
        tickers: A list of stock ticker symbols.
        period: The period for which to fetch the data (e.g., "1d", "5d", "1mo", "1y", "5y", "max").

    Returns:
        A dictionary where keys are ticker symbols and values are pandas DataFrames
        containing the OHLCV data. Returns an empty DataFrame for tickers with no data.
    """
    print(f"\n[Data Fetcher] Fetching OHLCV data for {len(tickers)} tickers for the period: {period}...")
    
    # Download all tickers at once for efficiency
    try:
        data = _fetch_ohlcv_batch(tickers, period)
    except Exception as e:
        print(f"❌ Failed to fetch batch OHLCV data after multiple retries: {e}")
        # Return empty DataFrames for all tickers if the batch download fails
        return {ticker: pd.DataFrame() for ticker in tickers}

    ohlcv_data = {}
    for ticker in tickers:
        if ticker in data and not data[ticker].empty:
            ohlcv_data[ticker] = data[ticker]
            print(f"  -> Fetched {len(data[ticker])} data points for {ticker}")
        else:
            print(f"  -> No data found for {ticker}")
            ohlcv_data[ticker] = pd.DataFrame()
            
    return ohlcv_data
