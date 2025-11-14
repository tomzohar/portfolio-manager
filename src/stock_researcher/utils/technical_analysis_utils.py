#!/usr/bin/env python3
"""
Technical Analysis Utilities
Calculates key technical indicators from OHLCV data.
"""

import pandas as pd
import pandas_ta as ta
from typing import Dict, Any

def calculate_technical_indicators(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculates a set of technical indicators for a given stock's OHLCV data.

    Args:
        df: A pandas DataFrame with columns ['Open', 'High', 'Low', 'Close', 'Volume'].

    Returns:
        A dictionary containing the latest values for the calculated indicators.
        Returns an empty dictionary if the DataFrame is too small for the calculations.
    """
    if df.empty or len(df) < 200:  # Need enough data for a 200-day SMA
        return {
            "error": "Not enough historical data to calculate full indicators."
        }
        
    indicators = {}
    
    # Calculate indicators individually to avoid the buggy .strategy() method
    sma_50 = df.ta.sma(length=50, append=False)
    sma_200 = df.ta.sma(length=200, append=False)
    rsi = df.ta.rsi(append=False)
    macd = df.ta.macd(append=False)

    # Extract the latest values
    latest_sma_50 = sma_50.iloc[-1]
    latest_sma_200 = sma_200.iloc[-1]
    latest_rsi = rsi.iloc[-1]
    latest_macd_line = macd['MACD_12_26_9'].iloc[-1]
    latest_macd_signal = macd['MACDs_12_26_9'].iloc[-1]
    latest_macd_hist = macd['MACDh_12_26_9'].iloc[-1]
    
    indicators = {
        'SMA_50': f"{latest_sma_50:.2f}",
        'SMA_200': f"{latest_sma_200:.2f}",
        'RSI': f"{latest_rsi:.2f}",
        'MACD_line': f"{latest_macd_line:.2f}",
        'MACD_signal': f"{latest_macd_signal:.2f}",
        'MACD_hist': f"{latest_macd_hist:.2f}"
    }
    
    # Add context about price relative to moving averages
    latest_close = df['Close'].iloc[-1]
    indicators['price_vs_SMA50'] = "above" if latest_close > latest_sma_50 else "below"
    indicators['price_vs_SMA200'] = "above" if latest_close > latest_sma_200 else "below"
    
    return indicators
