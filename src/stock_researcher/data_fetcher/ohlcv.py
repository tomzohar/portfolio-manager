#!/usr/bin/env python3
"""
OHLCV Data Fetcher
Fetches historical Open, High, Low, Close, and Volume data for stocks.
"""

import yfinance as yf
import pandas as pd
from typing import List, Dict

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
    
    ohlcv_data = {}
    for ticker in tickers:
        try:
            # Download data for a single ticker
            data = yf.download(ticker, period=period, progress=False)
            
            if not data.empty:
                ohlcv_data[ticker] = data
                print(f"  -> Fetched {len(data)} data points for {ticker}")
            else:
                print(f"  -> No data found for {ticker}")
                ohlcv_data[ticker] = pd.DataFrame()
        except Exception as e:
            print(f"  -> Failed to fetch data for {ticker}: {e}")
            ohlcv_data[ticker] = pd.DataFrame()
    
    return ohlcv_data
