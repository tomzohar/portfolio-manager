"""
Tests for Technical Agent Node.

Tests the LangGraph node for technical analysis including
OHLCV data fetching, indicator calculation, LLM integration,
and complete workflow execution.
"""

import pytest
import json
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock

from src.portfolio_manager.graph.nodes.technical_agent import (
    technical_agent_node,
    _analyze_ticker_technicals,
    _build_technical_prompt,
    _parse_technical_assessment
)
from src.portfolio_manager.agent_state import AgentState


# Fixtures


@pytest.fixture
def initial_state():
    """Sample initial agent state."""
    return {
        "portfolio": {
            "tickers": ["AAPL", "MSFT"],
            "positions": {
                "AAPL": 0.5,
                "MSFT": 0.5
            }
        },
        "reasoning_trace": []
    }


@pytest.fixture
def sample_ohlcv_data():
    """Sample OHLCV DataFrame."""
    dates = pd.date_range("2024-01-01", periods=250, freq="D")
    closes = np.linspace(100, 150, 250)
    
    return pd.DataFrame({
        "Date": dates,
        "Open": closes + np.random.normal(0, 1, 250),
        "High": closes + np.random.uniform(1, 3, 250),
        "Low": closes - np.random.uniform(1, 3, 250),
        "Close": closes,
        "Volume": np.random.uniform(1000000, 2000000, 250)
    })


@pytest.fixture
def mock_indicators():
    """Sample technical indicators."""
    return {
        "SMA_50": 145.0,
        "SMA_200": 130.0,
        "EMA_12": 148.0,
        "EMA_26": 143.0,
        "RSI": 65.0,
        "MACD_line": 2.5,
        "MACD_signal": 2.0,
        "MACD_hist": 0.5,
        "BB_upper": 155.0,
        "BB_middle": 150.0,
        "BB_lower": 145.0,
        "ATR": 3.5,
        "ADX": 28.0,
        "price_vs_SMA50": "above",
        "price_vs_SMA200": "above"
    }


@pytest.fixture
def mock_llm_response_buy():
    """Mock LLM response for Buy recommendation."""
    return json.dumps({
        "trend_assessment": "Strong Uptrend",
        "timing_recommendation": "Buy",
        "entry_price": 150.0,
        "stop_loss": 145.0,
        "target_price": 160.0,
        "rationale": "Strong uptrend with RSI showing healthy momentum. Price above both SMAs with bullish MACD crossover.",
        "key_signals": ["SMA crossover", "RSI bullish", "Volume confirmation"],
        "confidence": 0.85
    })


@pytest.fixture
def mock_llm_response_sell():
    """Mock LLM response for Sell recommendation."""
    return json.dumps({
        "trend_assessment": "Strong Downtrend",
        "timing_recommendation": "Sell",
        "entry_price": None,
        "stop_loss": None,
        "target_price": None,
        "rationale": "Strong downtrend with price below key moving averages. RSI oversold but no reversal signals yet.",
        "key_signals": ["Death cross", "RSI oversold", "High volume selloff"],
        "confidence": 0.80
    })


# Tests for technical_agent_node


def test_technical_agent_node_success(initial_state, mocker):
    """Test Technical Agent node with successful analysis."""
    # Mock fetch_ohlcv_data
    mock_ohlcv_result = {
        "success": True,
        "data": {
            "AAPL": pd.DataFrame({
                'Close': np.linspace(100, 150, 250),
                'High': np.linspace(102, 152, 250),
                'Low': np.linspace(98, 148, 250),
                'Open': np.linspace(100, 150, 250),
                'Volume': [1000000] * 250
            }),
            "MSFT": pd.DataFrame({
                'Close': np.linspace(200, 250, 250),
                'High': np.linspace(202, 252, 250),
                'Low': np.linspace(198, 248, 250),
                'Open': np.linspace(200, 250, 250),
                'Volume': [2000000] * 250
            })
        },
        "error": None
    }
    
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.fetch_ohlcv_data',
        return_value=mock_ohlcv_result
    )
    
    # Mock calculate_technical_indicators
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.calculate_technical_indicators',
        return_value={
            "SMA_50": 145.0,
            "SMA_200": 130.0,
            "RSI": 65.0,
            "MACD_line": 2.5,
            "MACD_signal": 2.0,
            "MACD_hist": 0.5,
            "BB_upper": 155.0,
            "BB_middle": 150.0,
            "BB_lower": 145.0,
            "ATR": 3.5,
            "ADX": 28.0,
            "price_vs_SMA50": "above",
            "price_vs_SMA200": "above"
        }
    )
    
    # Mock LLM response
    mock_llm_response = json.dumps({
        "trend_assessment": "Strong Uptrend",
        "timing_recommendation": "Buy",
        "entry_price": 150.0,
        "stop_loss": 145.0,
        "target_price": 160.0,
        "rationale": "Strong uptrend confirmed",
        "key_signals": ["SMA crossover"],
        "confidence": 0.85
    })
    
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.call_gemini_api',
        return_value=mock_llm_response
    )
    
    # Execute
    result = technical_agent_node(initial_state)
    
    # Assert
    assert "technical_analysis" in result
    assert len(result["technical_analysis"]) == 2
    assert "AAPL" in result["technical_analysis"]
    assert "MSFT" in result["technical_analysis"]
    
    # Check AAPL analysis
    aapl_analysis = result["technical_analysis"]["AAPL"]
    assert aapl_analysis["ticker"] == "AAPL"
    assert aapl_analysis["trend"] in ["Uptrend", "Downtrend", "Sideways"]
    assert "assessment" in aapl_analysis
    assert aapl_analysis["assessment"]["timing_recommendation"] == "Buy"
    
    # Check reasoning_trace updated
    assert len(result["reasoning_trace"]) == 1
    assert "Technical Agent" in result["reasoning_trace"][0]


def test_technical_agent_node_no_tickers():
    """Test Technical Agent node with no tickers."""
    state = {
        "portfolio": {},
        "reasoning_trace": []
    }
    
    result = technical_agent_node(state)
    
    assert result["technical_analysis"] == {}
    assert "No tickers" in result["reasoning_trace"][0]


def test_technical_agent_node_empty_tickers():
    """Test Technical Agent node with empty ticker list."""
    state = {
        "portfolio": {"tickers": []},
        "reasoning_trace": []
    }
    
    result = technical_agent_node(state)
    
    assert result["technical_analysis"] == {}
    assert len(result["reasoning_trace"]) == 1


def test_technical_agent_node_ohlcv_fetch_failure(initial_state, mocker):
    """Test Technical Agent node when OHLCV fetch fails."""
    # Mock fetch_ohlcv_data to fail
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.fetch_ohlcv_data',
        return_value={
            "success": False,
            "data": {},
            "error": "API connection failed"
        }
    )
    
    result = technical_agent_node(initial_state)
    
    assert "technical_analysis" in result
    assert "AAPL" in result["technical_analysis"]
    assert result["technical_analysis"]["AAPL"]["error"] is not None
    assert result["technical_analysis"]["AAPL"]["assessment"] is None


def test_technical_agent_node_llm_failure(initial_state, mocker):
    """Test Technical Agent node when LLM call fails."""
    # Mock successful OHLCV fetch
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.fetch_ohlcv_data',
        return_value={
            "success": True,
            "data": {
                "AAPL": pd.DataFrame({
                    'Close': np.linspace(100, 150, 250),
                    'High': np.linspace(102, 152, 250),
                    'Low': np.linspace(98, 148, 250),
                    'Open': np.linspace(100, 150, 250),
                    'Volume': [1000000] * 250
                })
            }
        }
    )
    
    # Mock successful indicator calculation
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.calculate_technical_indicators',
        return_value={
            "SMA_50": 145.0,
            "SMA_200": 130.0,
            "RSI": 65.0,
            "price_vs_SMA50": "above",
            "price_vs_SMA200": "above"
        }
    )
    
    # Mock LLM to raise exception
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.call_gemini_api',
        side_effect=Exception("LLM API timeout")
    )
    
    result = technical_agent_node(initial_state)
    
    # Should return analysis with None assessment but trend/indicators
    assert result["technical_analysis"]["AAPL"]["assessment"] is None
    assert result["technical_analysis"]["AAPL"]["trend"] is not None
    assert result["technical_analysis"]["AAPL"]["indicators"] is not None


# Tests for _analyze_ticker_technicals


def test_analyze_ticker_technicals_success(sample_ohlcv_data, mock_indicators, mock_llm_response_buy, mocker):
    """Test single ticker technical analysis."""
    # Mock fetch_ohlcv_data
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.fetch_ohlcv_data',
        return_value={
            "success": True,
            "data": {"AAPL": sample_ohlcv_data}
        }
    )
    
    # Mock calculate_technical_indicators
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.calculate_technical_indicators',
        return_value=mock_indicators
    )
    
    # Mock LLM
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.call_gemini_api',
        return_value=mock_llm_response_buy
    )
    
    result = _analyze_ticker_technicals("AAPL")
    
    assert result["ticker"] == "AAPL"
    assert result["trend"] is not None
    assert result["indicators"] == mock_indicators
    assert "support_resistance" in result
    assert "volume" in result
    assert result["assessment"] is not None
    assert result["error"] is None


def test_analyze_ticker_technicals_no_data(mocker):
    """Test ticker analysis with no OHLCV data."""
    # Mock fetch to return empty data
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.fetch_ohlcv_data',
        return_value={
            "success": True,
            "data": {}
        }
    )
    
    result = _analyze_ticker_technicals("INVALID")
    
    assert result["error"] is not None
    assert result["assessment"] is None


def test_analyze_ticker_technicals_indicator_error(sample_ohlcv_data, mocker):
    """Test ticker analysis when indicator calculation fails."""
    # Mock fetch
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.fetch_ohlcv_data',
        return_value={
            "success": True,
            "data": {"AAPL": sample_ohlcv_data}
        }
    )
    
    # Mock indicator calculation to return error
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.calculate_technical_indicators',
        return_value={"error": "Insufficient data"}
    )
    
    result = _analyze_ticker_technicals("AAPL")
    
    assert result["error"] is not None
    assert result["assessment"] is None


# Tests for _build_technical_prompt


def test_build_technical_prompt_format(sample_ohlcv_data, mock_indicators):
    """Test technical prompt formatting."""
    levels = {
        "support": [140.0, 135.0],
        "resistance": [155.0, 160.0]
    }
    volume_analysis = {
        "avg_volume": 1500000.0,
        "recent_volume": 2000000.0,
        "recent_spike": True,
        "trend": "Increasing",
        "volume_price_correlation": 0.75
    }
    
    prompt = _build_technical_prompt(
        ticker="AAPL",
        ohlcv=sample_ohlcv_data,
        indicators=mock_indicators,
        trend="Uptrend",
        levels=levels,
        volume_analysis=volume_analysis
    )
    
    # Check prompt contains key elements
    assert "AAPL" in prompt
    assert "Uptrend" in prompt
    assert "$145.00" in prompt  # SMA 50
    assert "$140.00" in prompt  # Support level
    assert "$155.00" in prompt  # Resistance level
    assert "65.00" in prompt  # RSI
    assert "Increasing" in prompt  # Volume trend
    assert "Strong Uptrend" in prompt or "assessment" in prompt.lower()


def test_build_technical_prompt_no_levels(sample_ohlcv_data, mock_indicators):
    """Test prompt building with no support/resistance levels."""
    levels = {
        "support": [],
        "resistance": []
    }
    volume_analysis = {
        "avg_volume": 1500000.0,
        "recent_volume": 2000000.0,
        "recent_spike": False,
        "trend": "Stable",
        "volume_price_correlation": 0.0
    }
    
    prompt = _build_technical_prompt(
        ticker="AAPL",
        ohlcv=sample_ohlcv_data,
        indicators=mock_indicators,
        trend="Sideways",
        levels=levels,
        volume_analysis=volume_analysis
    )
    
    assert "None detected" in prompt


# Tests for _parse_technical_assessment


def test_parse_technical_assessment_valid_json(mock_llm_response_buy):
    """Test parsing valid JSON response."""
    assessment = _parse_technical_assessment(mock_llm_response_buy)
    
    assert assessment["trend_assessment"] == "Strong Uptrend"
    assert assessment["timing_recommendation"] == "Buy"
    assert assessment["entry_price"] == 150.0
    assert assessment["confidence"] == 0.85
    assert "rationale" in assessment
    assert "key_signals" in assessment


def test_parse_technical_assessment_markdown_wrapped():
    """Test parsing JSON wrapped in markdown code blocks."""
    response = """
Here's my analysis:

```json
{
  "trend_assessment": "Weak Downtrend",
  "timing_recommendation": "Hold",
  "entry_price": null,
  "stop_loss": null,
  "target_price": null,
  "rationale": "Weak signals, recommend waiting",
  "key_signals": ["Mixed signals"],
  "confidence": 0.5
}
```

Hope this helps!
"""
    
    assessment = _parse_technical_assessment(response)
    
    assert assessment["trend_assessment"] == "Weak Downtrend"
    assert assessment["timing_recommendation"] == "Hold"
    assert assessment["confidence"] == 0.5


def test_parse_technical_assessment_invalid_json():
    """Test parsing invalid JSON response."""
    invalid_response = "This is not JSON. The stock looks good!"
    
    assessment = _parse_technical_assessment(invalid_response)
    
    # Should return fallback assessment
    assert assessment["timing_recommendation"] == "Hold"
    assert assessment["confidence"] == 0.3
    assert "Unable to parse" in assessment["rationale"]


def test_parse_technical_assessment_missing_fields():
    """Test parsing JSON with missing required fields."""
    incomplete_response = json.dumps({
        "trend_assessment": "Uptrend",
        # Missing timing_recommendation, rationale, confidence
    })
    
    assessment = _parse_technical_assessment(incomplete_response)
    
    # Should return fallback assessment
    assert assessment["timing_recommendation"] == "Hold"
    assert assessment["confidence"] == 0.3


# Integration tests


def test_full_technical_agent_workflow(initial_state, sample_ohlcv_data, mocker):
    """Test complete technical agent workflow end-to-end."""
    # Setup all mocks
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.fetch_ohlcv_data',
        return_value={
            "success": True,
            "data": {
                "AAPL": sample_ohlcv_data,
                "MSFT": sample_ohlcv_data
            }
        }
    )
    
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.calculate_technical_indicators',
        return_value={
            "SMA_50": 145.0,
            "SMA_200": 130.0,
            "RSI": 65.0,
            "MACD_line": 2.5,
            "MACD_signal": 2.0,
            "MACD_hist": 0.5,
            "BB_upper": 155.0,
            "BB_middle": 150.0,
            "BB_lower": 145.0,
            "ATR": 3.5,
            "ADX": 28.0,
            "price_vs_SMA50": "above",
            "price_vs_SMA200": "above"
        }
    )
    
    mocker.patch(
        'src.portfolio_manager.graph.nodes.technical_agent.call_gemini_api',
        return_value=json.dumps({
            "trend_assessment": "Strong Uptrend",
            "timing_recommendation": "Buy",
            "entry_price": 150.0,
            "stop_loss": 145.0,
            "target_price": 160.0,
            "rationale": "Bullish setup confirmed",
            "key_signals": ["SMA crossover", "Volume spike"],
            "confidence": 0.85
        })
    )
    
    # Execute full workflow
    result = technical_agent_node(initial_state)
    
    # Comprehensive assertions
    assert result is not None
    assert "technical_analysis" in result
    assert len(result["technical_analysis"]) == 2
    
    for ticker in ["AAPL", "MSFT"]:
        analysis = result["technical_analysis"][ticker]
        assert analysis["ticker"] == ticker
        assert analysis["trend"] in ["Uptrend", "Downtrend", "Sideways"]
        assert "indicators" in analysis
        assert "support_resistance" in analysis
        assert "volume" in analysis
        assert analysis["assessment"] is not None
        assert analysis["assessment"]["timing_recommendation"] in ["Buy", "Sell", "Hold"]
        assert 0 <= analysis["assessment"]["confidence"] <= 1
    
    assert "reasoning_trace" in result
    assert len(result["reasoning_trace"]) > 0

