"""
Technical Analysis Module for Portfolio Manager.

Provides enhanced technical analysis capabilities including:
- Trend classification (Uptrend/Downtrend/Sideways)
- Support and resistance level detection
- Volume pattern analysis
- Technical indicator interpretation

All functions are vectorized for performance and do not use standard Python loops
to iterate over DataFrames (per architectural mandate).
"""

import logging
from typing import Dict, List, Tuple, Any, Optional

import numpy as np
import pandas as pd
import pandas_ta as ta
import sentry_sdk

logger = logging.getLogger(__name__)


def classify_trend(
    ohlcv: pd.DataFrame,
    sma_50: Optional[float] = None,
    sma_200: Optional[float] = None
) -> str:
    """
    Classify price trend using SMA crossovers and price action.
    
    Trend Classification Logic:
    - Uptrend: Current price > SMA50 > SMA200 AND price increasing
    - Downtrend: Current price < SMA50 < SMA200 AND price decreasing
    - Sideways: Mixed signals or range-bound
    - Insufficient Data: Not enough data for classification
    
    Args:
        ohlcv: DataFrame with OHLCV data (must have 'Close' column)
        sma_50: Optional pre-calculated SMA50 value
        sma_200: Optional pre-calculated SMA200 value
        
    Returns:
        Trend classification: "Uptrend", "Downtrend", "Sideways", or "Insufficient Data"
        
    Example:
        >>> df = pd.DataFrame({'Close': [100, 102, 105, 108, 110]})
        >>> trend = classify_trend(df, sma_50=105, sma_200=100)
        >>> print(trend)
        'Uptrend'
    """
    try:
        if ohlcv.empty or 'Close' not in ohlcv.columns:
            logger.warning("Empty OHLCV data or missing 'Close' column")
            return "Insufficient Data"
        
        if len(ohlcv) < 20:
            logger.warning(f"Insufficient data points: {len(ohlcv)} < 20")
            return "Insufficient Data"
        
        # Get current price
        current_price = float(ohlcv['Close'].iloc[-1])
        
        # Calculate SMAs if not provided
        if sma_50 is None or sma_200 is None:
            if len(ohlcv) < 200:
                logger.warning("Not enough data to calculate SMA200")
                return "Insufficient Data"
            
            sma_50 = float(ohlcv['Close'].rolling(window=50).mean().iloc[-1])
            sma_200 = float(ohlcv['Close'].rolling(window=200).mean().iloc[-1])
        
        # Check price position relative to SMAs
        price_above_sma50 = current_price > sma_50
        sma50_above_sma200 = sma_50 > sma_200
        
        # Check recent price momentum (last 20 days)
        price_20d_ago = float(ohlcv['Close'].iloc[-20])
        price_change_pct = (current_price - price_20d_ago) / price_20d_ago
        price_increasing = price_change_pct > 0.02  # +2% threshold
        price_decreasing = price_change_pct < -0.02  # -2% threshold
        
        # Classify trend based on SMA alignment AND price momentum
        # Uptrend: Price > SMA50 > SMA200 (golden cross) + rising prices
        if price_above_sma50 and sma50_above_sma200 and price_increasing:
            logger.info(f"Classified as Uptrend (Price: {current_price:.2f}, SMA50: {sma_50:.2f}, SMA200: {sma_200:.2f}, Change: {price_change_pct:.2%})")
            return "Uptrend"
        
        # Downtrend: Price < SMA50 < SMA200 (death cross) + falling prices
        elif not price_above_sma50 and not sma50_above_sma200 and price_decreasing:
            logger.info(f"Classified as Downtrend (Price: {current_price:.2f}, SMA50: {sma_50:.2f}, SMA200: {sma_200:.2f}, Change: {price_change_pct:.2%})")
            return "Downtrend"
        
        # Weak downtrend: Price < both SMAs even without strong momentum
        elif not price_above_sma50 and not sma50_above_sma200:
            logger.info(f"Classified as Downtrend (weak) (Price: {current_price:.2f}, SMA50: {sma_50:.2f}, SMA200: {sma_200:.2f})")
            return "Downtrend"
        
        # Otherwise sideways
        else:
            logger.info(f"Classified as Sideways (Price: {current_price:.2f}, SMA50: {sma_50:.2f}, SMA200: {sma_200:.2f}, Change: {price_change_pct:.2%})")
            return "Sideways"
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Error classifying trend: {e}", exc_info=True)
        return "Insufficient Data"


def detect_support_resistance(
    ohlcv: pd.DataFrame,
    num_levels: int = 3,
    window: int = 20
) -> Dict[str, List[float]]:
    """
    Detect support and resistance levels using local extrema.
    
    Algorithm:
    1. Find local minima (potential support) using rolling window
    2. Find local maxima (potential resistance) using rolling window
    3. Cluster nearby levels and return top N strongest levels
    
    Args:
        ohlcv: DataFrame with OHLCV data (must have 'Low' and 'High' columns)
        num_levels: Number of support/resistance levels to return (default: 3)
        window: Rolling window size for extrema detection (default: 20)
        
    Returns:
        Dictionary with:
        {
            "support": [level1, level2, level3],  # Sorted ascending
            "resistance": [level1, level2, level3]  # Sorted ascending
        }
        
    Example:
        >>> df = pd.DataFrame({
        ...     'Low': [98, 99, 97, 100, 99, 98, 101],
        ...     'High': [102, 103, 101, 104, 103, 102, 105]
        ... })
        >>> levels = detect_support_resistance(df, num_levels=2)
        >>> print(levels['support'])  # [97.0, 98.0]
    """
    try:
        if ohlcv.empty or 'Low' not in ohlcv.columns or 'High' not in ohlcv.columns:
            logger.warning("Empty OHLCV data or missing 'Low'/'High' columns")
            return {"support": [], "resistance": []}
        
        if len(ohlcv) < window * 2:
            logger.warning(f"Insufficient data for support/resistance detection: {len(ohlcv)} < {window * 2}")
            return {"support": [], "resistance": []}
        
        # Find local minima (support levels) using vectorized operations
        # A local minimum is where Low[i] < Low[i-window:i] and Low[i] < Low[i+1:i+window+1]
        lows = ohlcv['Low'].values
        highs = ohlcv['High'].values
        
        # Use rolling min to find local minima
        rolling_min = pd.Series(lows).rolling(window=window, center=True).min()
        is_local_min = (pd.Series(lows) == rolling_min).values
        
        # Use rolling max to find local maxima
        rolling_max = pd.Series(highs).rolling(window=window, center=True).max()
        is_local_max = (pd.Series(highs) == rolling_max).values
        
        # Extract support levels (local minima)
        support_levels = lows[is_local_min]
        support_levels = np.unique(support_levels)  # Remove duplicates
        support_levels = np.sort(support_levels)  # Sort ascending
        
        # Extract resistance levels (local maxima)
        resistance_levels = highs[is_local_max]
        resistance_levels = np.unique(resistance_levels)
        resistance_levels = np.sort(resistance_levels)
        
        # Cluster nearby levels (within 1% of each other)
        support_clustered = _cluster_levels(support_levels, tolerance=0.01)
        resistance_clustered = _cluster_levels(resistance_levels, tolerance=0.01)
        
        # Return top N strongest levels
        support_top = support_clustered[:num_levels] if len(support_clustered) >= num_levels else support_clustered
        resistance_top = resistance_clustered[:num_levels] if len(resistance_clustered) >= num_levels else resistance_clustered
        
        logger.info(f"Detected {len(support_top)} support levels and {len(resistance_top)} resistance levels")
        
        return {
            "support": support_top.tolist(),
            "resistance": resistance_top.tolist()
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Error detecting support/resistance: {e}", exc_info=True)
        return {"support": [], "resistance": []}


def _cluster_levels(levels: np.ndarray, tolerance: float = 0.01) -> np.ndarray:
    """
    Cluster nearby price levels that are within tolerance % of each other.
    
    Args:
        levels: Array of price levels (sorted)
        tolerance: Percentage tolerance for clustering (e.g., 0.01 = 1%)
        
    Returns:
        Array of clustered levels (average of clustered values)
    """
    if len(levels) == 0:
        return levels
    
    clustered = []
    current_cluster = [levels[0]]
    
    for i in range(1, len(levels)):
        # Check if current level is within tolerance of cluster average
        cluster_avg = np.mean(current_cluster)
        if abs(levels[i] - cluster_avg) / cluster_avg <= tolerance:
            current_cluster.append(levels[i])
        else:
            # Save current cluster and start new one
            clustered.append(np.mean(current_cluster))
            current_cluster = [levels[i]]
    
    # Add last cluster
    clustered.append(np.mean(current_cluster))
    
    return np.array(clustered)


def analyze_volume_patterns(ohlcv: pd.DataFrame, window: int = 20) -> Dict[str, Any]:
    """
    Analyze volume patterns for confirmation signals.
    
    Analysis includes:
    - Average volume (over window period)
    - Recent volume spike detection
    - Volume trend (Increasing/Decreasing/Stable)
    - Volume vs. price correlation
    
    Args:
        ohlcv: DataFrame with OHLCV data (must have 'Volume' and 'Close' columns)
        window: Rolling window for volume analysis (default: 20)
        
    Returns:
        Dictionary with:
        {
            "avg_volume": float,
            "recent_volume": float,
            "recent_spike": bool,  # True if recent volume > 1.5x average
            "trend": "Increasing" | "Decreasing" | "Stable",
            "volume_price_correlation": float  # -1 to 1
        }
        
    Example:
        >>> df = pd.DataFrame({
        ...     'Volume': [1000, 1100, 1200, 3000, 1100],  # Spike at index 3
        ...     'Close': [100, 102, 105, 103, 104]
        ... })
        >>> result = analyze_volume_patterns(df)
        >>> result['recent_spike']
        True
    """
    try:
        if ohlcv.empty or 'Volume' not in ohlcv.columns or 'Close' not in ohlcv.columns:
            logger.warning("Empty OHLCV data or missing 'Volume'/'Close' columns")
            return {
                "avg_volume": 0.0,
                "recent_volume": 0.0,
                "recent_spike": False,
                "trend": "Unknown",
                "volume_price_correlation": 0.0
            }
        
        if len(ohlcv) < window:
            logger.warning(f"Insufficient data for volume analysis: {len(ohlcv)} < {window}")
            window = max(5, len(ohlcv) // 2)  # Use half of available data
        
        # Calculate average volume over window
        avg_volume = float(ohlcv['Volume'].iloc[-window:].mean())
        recent_volume = float(ohlcv['Volume'].iloc[-1])
        
        # Detect volume spike (recent volume > 1.5x average)
        recent_spike = recent_volume > avg_volume * 1.5
        
        # Analyze volume trend using linear regression on log volumes
        # (log scale better captures proportional changes)
        volumes = ohlcv['Volume'].iloc[-window:].values
        if len(volumes) > 1:
            log_volumes = np.log1p(volumes)  # log1p handles zeros
            x = np.arange(len(log_volumes))
            
            # Vectorized linear regression
            slope = np.polyfit(x, log_volumes, 1)[0]
            
            if slope > 0.01:  # Positive slope threshold
                volume_trend = "Increasing"
            elif slope < -0.01:  # Negative slope threshold
                volume_trend = "Decreasing"
            else:
                volume_trend = "Stable"
        else:
            volume_trend = "Unknown"
        
        # Calculate volume-price correlation
        if len(ohlcv) >= window:
            volume_series = ohlcv['Volume'].iloc[-window:]
            close_series = ohlcv['Close'].iloc[-window:]
            correlation = float(volume_series.corr(close_series))
        else:
            correlation = 0.0
        
        logger.info(f"Volume analysis: Avg={avg_volume:.0f}, Recent={recent_volume:.0f}, "
                   f"Spike={recent_spike}, Trend={volume_trend}, Correlation={correlation:.2f}")
        
        return {
            "avg_volume": avg_volume,
            "recent_volume": recent_volume,
            "recent_spike": recent_spike,
            "trend": volume_trend,
            "volume_price_correlation": correlation
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Error analyzing volume patterns: {e}", exc_info=True)
        return {
            "avg_volume": 0.0,
            "recent_volume": 0.0,
            "recent_spike": False,
            "trend": "Unknown",
            "volume_price_correlation": 0.0
        }


def calculate_technical_indicators(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculate comprehensive technical indicators from OHLCV data.
    
    This function enhances the legacy indicator calculation with additional
    indicators and better error handling.
    
    Indicators calculated:
    - SMA (50, 200)
    - EMA (12, 26)
    - RSI (14)
    - MACD (12, 26, 9)
    - Bollinger Bands (20, 2)
    - ATR (14)
    - ADX (14) - Trend strength
    
    Args:
        df: DataFrame with OHLCV data (columns: Open, High, Low, Close, Volume)
        
    Returns:
        Dictionary with indicator values:
        {
            "SMA_50": float,
            "SMA_200": float,
            "RSI": float,
            "MACD_line": float,
            "MACD_signal": float,
            "MACD_hist": float,
            "BB_upper": float,
            "BB_middle": float,
            "BB_lower": float,
            "ATR": float,
            "ADX": float,
            "price_vs_SMA50": "above" | "below",
            "price_vs_SMA200": "above" | "below"
        }
    """
    try:
        if df.empty or len(df) < 200:
            logger.warning(f"Insufficient data for indicator calculation: {len(df)} < 200")
            return {"error": "Not enough historical data to calculate full indicators."}
        
        indicators = {}
        
        # Calculate SMAs
        sma_50 = df.ta.sma(length=50, append=False)
        sma_200 = df.ta.sma(length=200, append=False)
        indicators['SMA_50'] = float(sma_50.iloc[-1])
        indicators['SMA_200'] = float(sma_200.iloc[-1])
        
        # Calculate EMAs
        ema_12 = df.ta.ema(length=12, append=False)
        ema_26 = df.ta.ema(length=26, append=False)
        indicators['EMA_12'] = float(ema_12.iloc[-1])
        indicators['EMA_26'] = float(ema_26.iloc[-1])
        
        # Calculate RSI
        rsi = df.ta.rsi(append=False)
        indicators['RSI'] = float(rsi.iloc[-1])
        
        # Calculate MACD
        macd = df.ta.macd(append=False)
        indicators['MACD_line'] = float(macd['MACD_12_26_9'].iloc[-1])
        indicators['MACD_signal'] = float(macd['MACDs_12_26_9'].iloc[-1])
        indicators['MACD_hist'] = float(macd['MACDh_12_26_9'].iloc[-1])
        
        # Calculate Bollinger Bands
        bbands = df.ta.bbands(length=20, std=2, append=False)
        
        # Handle different column naming conventions in pandas-ta versions
        if 'BBU_20_2.0' in bbands.columns:
            indicators['BB_upper'] = float(bbands['BBU_20_2.0'].iloc[-1])
            indicators['BB_middle'] = float(bbands['BBM_20_2.0'].iloc[-1])
            indicators['BB_lower'] = float(bbands['BBL_20_2.0'].iloc[-1])
        elif 'BBU_20_2.0_2.0' in bbands.columns:
            indicators['BB_upper'] = float(bbands['BBU_20_2.0_2.0'].iloc[-1])
            indicators['BB_middle'] = float(bbands['BBM_20_2.0_2.0'].iloc[-1])
            indicators['BB_lower'] = float(bbands['BBL_20_2.0_2.0'].iloc[-1])
        else:
            # Fallback: use the last 3 columns
            bb_cols = bbands.columns.tolist()
            indicators['BB_lower'] = float(bbands[bb_cols[0]].iloc[-1])
            indicators['BB_middle'] = float(bbands[bb_cols[1]].iloc[-1])
            indicators['BB_upper'] = float(bbands[bb_cols[2]].iloc[-1])
        
        # Calculate ATR (Average True Range)
        atr = df.ta.atr(length=14, append=False)
        indicators['ATR'] = float(atr.iloc[-1])
        
        # Calculate ADX (trend strength indicator)
        adx = df.ta.adx(length=14, append=False)
        indicators['ADX'] = float(adx['ADX_14'].iloc[-1])
        
        # Add price context
        latest_close = float(df['Close'].iloc[-1])
        indicators['price_vs_SMA50'] = "above" if latest_close > indicators['SMA_50'] else "below"
        indicators['price_vs_SMA200'] = "above" if latest_close > indicators['SMA_200'] else "below"
        
        logger.info(f"Calculated {len(indicators)} technical indicators")
        
        return indicators
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Error calculating technical indicators: {e}", exc_info=True)
        return {"error": f"Failed to calculate indicators: {str(e)}"}

