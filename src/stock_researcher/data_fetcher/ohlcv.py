#!/usr/bin/env python3
"""
OHLCV Data Fetcher
Fetches historical Open, High, Low, Close, and Volume data for stocks.
"""

import pandas as pd
from typing import List, Dict
from datetime import datetime, timedelta
from polygon import RESTClient
from ..config import POLYGON_API_KEY

def fetch_ohlcv_data(tickers: List[str], period: str = "1y") -> Dict[str, pd.DataFrame]:
    """
    Fetches historical OHLCV data for a list of stock tickers using the Polygon API.

    Args:
        tickers: A list of stock ticker symbols.
        period: The period for which to fetch the data (e.g., "1y", "2y").

    Returns:
        A dictionary where keys are ticker symbols and values are pandas DataFrames
        containing the OHLCV data. Returns an empty DataFrame for tickers with no data.
    """
    print(f"\n[Data Fetcher] Fetching OHLCV data for {len(tickers)} tickers for the period: {period}...")
    
    client = RESTClient(POLYGON_API_KEY)
    
    # Calculate the date range
    to_date = datetime.now().date()
    if period.endswith('y'):
        years = int(period[:-1])
        from_date = to_date - timedelta(days=years * 365)
    else:
        # Default to 1 year if period format is unrecognized
        from_date = to_date - timedelta(days=365)

    ohlcv_data = {}
    for ticker in tickers:
        try:
            resp = client.get_aggs(ticker, 1, "day", from_date, to_date)
            
            if not resp:
                print(f"  -> No data found for {ticker}")
                ohlcv_data[ticker] = pd.DataFrame()
                continue

            df = pd.DataFrame(resp)
            df['datetime'] = pd.to_datetime(df.timestamp, unit='ms')
            df.set_index('datetime', inplace=True)
            df.rename(columns={
                'open': 'Open',
                'high': 'High',
                'low': 'Low',
                'close': 'Close',
                'volume': 'Volume'
            }, inplace=True)
            
            # Ensure the DataFrame has the same structure as yfinance
            ohlcv_data[ticker] = df[['Open', 'High', 'Low', 'Close', 'Volume']]
            print(f"  -> Fetched {len(df)} data points for {ticker}")

        except Exception as e:
            print(f"  -> Error fetching data for {ticker}: {e}")
            ohlcv_data[ticker] = pd.DataFrame()
            
    return ohlcv_data
