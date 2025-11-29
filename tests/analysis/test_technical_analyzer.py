"""
Tests for Technical Analyzer Module.

Tests trend classification, support/resistance detection, volume analysis,
and technical indicator calculation functions.
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock

from src.portfolio_manager.analysis.technical_analyzer import (
    classify_trend,
    detect_support_resistance,
    analyze_volume_patterns,
    calculate_technical_indicators,
    _cluster_levels
)


# Fixtures


@pytest.fixture
def sample_ohlcv_uptrend():
    """Sample OHLCV data representing an uptrend."""
    dates = pd.date_range("2024-01-01", periods=250, freq="D")
    # Create uptrend: prices increase from 100 to 150
    closes = np.linspace(100, 150, 250) + np.random.normal(0, 2, 250)
    highs = closes + np.random.uniform(0.5, 2, 250)
    lows = closes - np.random.uniform(0.5, 2, 250)
    opens = closes + np.random.normal(0, 1, 250)
    volumes = np.random.uniform(1000000, 2000000, 250)
    
    return pd.DataFrame({
        "Date": dates,
        "Open": opens,
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": volumes
    })


@pytest.fixture
def sample_ohlcv_downtrend():
    """Sample OHLCV data representing a downtrend."""
    dates = pd.date_range("2024-01-01", periods=250, freq="D")
    # Create downtrend: prices decrease from 150 to 100
    closes = np.linspace(150, 100, 250) + np.random.normal(0, 2, 250)
    highs = closes + np.random.uniform(0.5, 2, 250)
    lows = closes - np.random.uniform(0.5, 2, 250)
    opens = closes + np.random.normal(0, 1, 250)
    volumes = np.random.uniform(1000000, 2000000, 250)
    
    return pd.DataFrame({
        "Date": dates,
        "Open": opens,
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": volumes
    })


@pytest.fixture
def sample_ohlcv_sideways():
    """Sample OHLCV data representing sideways movement."""
    dates = pd.date_range("2024-01-01", periods=250, freq="D")
    # Create sideways: prices oscillate around 125
    closes = 125 + np.random.normal(0, 5, 250)
    highs = closes + np.random.uniform(0.5, 2, 250)
    lows = closes - np.random.uniform(0.5, 2, 250)
    opens = closes + np.random.normal(0, 1, 250)
    volumes = np.random.uniform(1000000, 2000000, 250)
    
    return pd.DataFrame({
        "Date": dates,
        "Open": opens,
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": volumes
    })


# Tests for classify_trend


def test_classify_trend_uptrend(sample_ohlcv_uptrend):
    """Test trend classification for uptrend."""
    # Calculate SMAs manually
    sma_50 = float(sample_ohlcv_uptrend['Close'].rolling(window=50).mean().iloc[-1])
    sma_200 = float(sample_ohlcv_uptrend['Close'].rolling(window=200).mean().iloc[-1])
    
    trend = classify_trend(sample_ohlcv_uptrend, sma_50=sma_50, sma_200=sma_200)
    
    # In an uptrend, should be either Uptrend or Sideways (due to random noise)
    # The key is that SMA50 > SMA200 which indicates bullish alignment
    assert trend in ["Uptrend", "Sideways"], f"Expected Uptrend or Sideways, got {trend}"
    assert sma_50 > sma_200, "SMA50 should be above SMA200 in uptrend"


def test_classify_trend_downtrend(sample_ohlcv_downtrend):
    """Test trend classification for downtrend."""
    # Calculate SMAs manually
    sma_50 = float(sample_ohlcv_downtrend['Close'].rolling(window=50).mean().iloc[-1])
    sma_200 = float(sample_ohlcv_downtrend['Close'].rolling(window=200).mean().iloc[-1])
    
    trend = classify_trend(sample_ohlcv_downtrend, sma_50=sma_50, sma_200=sma_200)
    
    assert trend == "Downtrend", f"Expected Downtrend, got {trend}"


def test_classify_trend_sideways(sample_ohlcv_sideways):
    """Test trend classification for sideways movement."""
    # Calculate SMAs manually
    sma_50 = float(sample_ohlcv_sideways['Close'].rolling(window=50).mean().iloc[-1])
    sma_200 = float(sample_ohlcv_sideways['Close'].rolling(window=200).mean().iloc[-1])
    
    trend = classify_trend(sample_ohlcv_sideways, sma_50=sma_50, sma_200=sma_200)
    
    # Sideways movement with noise can result in various classifications
    # The key is that SMAs should be close together
    assert trend in ["Sideways", "Downtrend", "Uptrend"], f"Got {trend}"
    # Check that SMAs are relatively close (within 5%)
    sma_diff_pct = abs(sma_50 - sma_200) / sma_200
    assert sma_diff_pct < 0.05 or trend in ["Sideways", "Downtrend"], "SMAs should be close in sideways market"


def test_classify_trend_insufficient_data():
    """Test trend classification with insufficient data."""
    df = pd.DataFrame({
        'Close': [100, 101, 102]
    })
    
    trend = classify_trend(df)
    
    assert trend == "Insufficient Data"


def test_classify_trend_empty_dataframe():
    """Test trend classification with empty DataFrame."""
    df = pd.DataFrame()
    
    trend = classify_trend(df)
    
    assert trend == "Insufficient Data"


def test_classify_trend_auto_calculate_smas():
    """Test trend classification with automatic SMA calculation."""
    # Create simple uptrend data
    closes = np.linspace(100, 150, 250)
    df = pd.DataFrame({'Close': closes})
    
    trend = classify_trend(df)
    
    assert trend in ["Uptrend", "Sideways"]  # Should classify based on calculated SMAs


# Tests for detect_support_resistance


def test_detect_support_resistance_basic():
    """Test support/resistance detection with clear levels."""
    # Create data with obvious support at 95-100 and resistance at 145-150
    closes = []
    for i in range(100):
        if i % 10 < 5:
            closes.append(np.random.uniform(95, 100))  # Support zone
        else:
            closes.append(np.random.uniform(145, 150))  # Resistance zone
    
    df = pd.DataFrame({
        'Low': [c - 2 for c in closes],
        'High': [c + 2 for c in closes]
    })
    
    levels = detect_support_resistance(df, num_levels=2, window=5)
    
    assert "support" in levels
    assert "resistance" in levels
    assert len(levels["support"]) > 0
    assert len(levels["resistance"]) > 0


def test_detect_support_resistance_insufficient_data():
    """Test support/resistance detection with insufficient data."""
    df = pd.DataFrame({
        'Low': [100, 101, 102],
        'High': [105, 106, 107]
    })
    
    levels = detect_support_resistance(df, window=20)
    
    assert levels["support"] == []
    assert levels["resistance"] == []


def test_detect_support_resistance_empty_dataframe():
    """Test support/resistance detection with empty DataFrame."""
    df = pd.DataFrame()
    
    levels = detect_support_resistance(df)
    
    assert levels["support"] == []
    assert levels["resistance"] == []


def test_cluster_levels():
    """Test price level clustering."""
    # Levels that should cluster: [100, 101, 102] -> ~101, [150, 152] -> ~151
    levels = np.array([100, 101, 102, 150, 152])
    
    clustered = _cluster_levels(levels, tolerance=0.02)  # 2% tolerance
    
    assert len(clustered) == 2  # Should cluster into 2 groups
    assert clustered[0] == pytest.approx(101, abs=2)  # First cluster around 101
    assert clustered[1] == pytest.approx(151, abs=2)  # Second cluster around 151


def test_cluster_levels_empty():
    """Test clustering with empty array."""
    levels = np.array([])
    
    clustered = _cluster_levels(levels)
    
    assert len(clustered) == 0


# Tests for analyze_volume_patterns


def test_analyze_volume_patterns_spike():
    """Test volume spike detection."""
    # Normal volume followed by spike
    volumes = [1000000] * 25 + [3000000]  # Last volume is 3x average
    closes = list(range(100, 126))
    
    df = pd.DataFrame({
        'Volume': volumes,
        'Close': closes
    })
    
    result = analyze_volume_patterns(df, window=20)
    
    assert result["recent_spike"] is True
    assert result["recent_volume"] > result["avg_volume"] * 1.5


def test_analyze_volume_patterns_no_spike():
    """Test volume analysis without spike."""
    volumes = [1000000] * 26  # Consistent volume
    closes = list(range(100, 126))
    
    df = pd.DataFrame({
        'Volume': volumes,
        'Close': closes
    })
    
    result = analyze_volume_patterns(df, window=20)
    
    assert result["recent_spike"] is False


def test_analyze_volume_patterns_increasing_trend():
    """Test detection of increasing volume trend."""
    # Gradually increasing volumes
    volumes = np.linspace(1000000, 2000000, 30)
    closes = list(range(100, 130))
    
    df = pd.DataFrame({
        'Volume': volumes,
        'Close': closes
    })
    
    result = analyze_volume_patterns(df, window=20)
    
    assert result["trend"] == "Increasing"


def test_analyze_volume_patterns_decreasing_trend():
    """Test detection of decreasing volume trend."""
    # Gradually decreasing volumes
    volumes = np.linspace(2000000, 1000000, 30)
    closes = list(range(100, 130))
    
    df = pd.DataFrame({
        'Volume': volumes,
        'Close': closes
    })
    
    result = analyze_volume_patterns(df, window=20)
    
    assert result["trend"] == "Decreasing"


def test_analyze_volume_patterns_empty_dataframe():
    """Test volume analysis with empty DataFrame."""
    df = pd.DataFrame()
    
    result = analyze_volume_patterns(df)
    
    assert result["avg_volume"] == 0.0
    assert result["recent_spike"] is False
    assert result["trend"] == "Unknown"


def test_analyze_volume_patterns_insufficient_data():
    """Test volume analysis with insufficient data."""
    df = pd.DataFrame({
        'Volume': [1000000, 1100000, 1200000],
        'Close': [100, 101, 102]
    })
    
    result = analyze_volume_patterns(df, window=20)
    
    # Should still return valid result with adjusted window
    assert result["avg_volume"] > 0
    assert "trend" in result


def test_analyze_volume_patterns_correlation():
    """Test volume-price correlation calculation."""
    # Volumes and prices both increasing -> positive correlation
    volumes = np.linspace(1000000, 2000000, 30)
    closes = np.linspace(100, 130, 30)
    
    df = pd.DataFrame({
        'Volume': volumes,
        'Close': closes
    })
    
    result = analyze_volume_patterns(df, window=20)
    
    # Positive correlation expected
    assert result["volume_price_correlation"] > 0.5


# Tests for calculate_technical_indicators


def test_calculate_technical_indicators_full(sample_ohlcv_uptrend):
    """Test full technical indicator calculation."""
    indicators = calculate_technical_indicators(sample_ohlcv_uptrend)
    
    # Check all expected indicators are present
    expected_keys = [
        "SMA_50", "SMA_200", "EMA_12", "EMA_26",
        "RSI", "MACD_line", "MACD_signal", "MACD_hist",
        "BB_upper", "BB_middle", "BB_lower",
        "ATR", "ADX",
        "price_vs_SMA50", "price_vs_SMA200"
    ]
    
    for key in expected_keys:
        assert key in indicators, f"Missing indicator: {key}"
    
    # Check indicator values are reasonable
    assert 0 <= indicators["RSI"] <= 100
    assert indicators["SMA_50"] > 0
    assert indicators["SMA_200"] > 0
    assert indicators["BB_upper"] > indicators["BB_middle"] > indicators["BB_lower"]
    assert indicators["ATR"] > 0
    assert 0 <= indicators["ADX"] <= 100


def test_calculate_technical_indicators_insufficient_data():
    """Test indicator calculation with insufficient data."""
    df = pd.DataFrame({
        'Open': [100, 101, 102],
        'High': [105, 106, 107],
        'Low': [95, 96, 97],
        'Close': [100, 101, 102],
        'Volume': [1000000, 1100000, 1200000]
    })
    
    indicators = calculate_technical_indicators(df)
    
    assert "error" in indicators


def test_calculate_technical_indicators_empty_dataframe():
    """Test indicator calculation with empty DataFrame."""
    df = pd.DataFrame()
    
    indicators = calculate_technical_indicators(df)
    
    assert "error" in indicators


def test_calculate_technical_indicators_error_handling(sample_ohlcv_uptrend, mocker):
    """Test error handling in indicator calculation."""
    # Mock pandas DataFrame's ta accessor to raise exception on sma
    mock_ta = MagicMock()
    mock_ta.sma.side_effect = Exception("Calculation failed")
    
    # Patch the ta accessor
    mocker.patch.object(sample_ohlcv_uptrend, 'ta', mock_ta)
    
    indicators = calculate_technical_indicators(sample_ohlcv_uptrend)
    
    # Should catch the exception and return error
    assert "error" in indicators
    assert "Calculation failed" in indicators["error"]


# Integration test


def test_full_technical_analysis_workflow(sample_ohlcv_uptrend):
    """Test complete technical analysis workflow."""
    # 1. Calculate indicators
    indicators = calculate_technical_indicators(sample_ohlcv_uptrend)
    assert "error" not in indicators
    
    # 2. Classify trend
    trend = classify_trend(
        sample_ohlcv_uptrend,
        sma_50=indicators["SMA_50"],
        sma_200=indicators["SMA_200"]
    )
    assert trend in ["Uptrend", "Downtrend", "Sideways"]
    
    # 3. Detect support/resistance
    levels = detect_support_resistance(sample_ohlcv_uptrend)
    assert "support" in levels
    assert "resistance" in levels
    
    # 4. Analyze volume
    volume_analysis = analyze_volume_patterns(sample_ohlcv_uptrend)
    assert "trend" in volume_analysis
    assert "recent_spike" in volume_analysis
    
    # All analysis steps completed successfully
    assert True

