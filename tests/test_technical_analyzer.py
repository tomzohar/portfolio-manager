import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from stock_researcher.agents.technical_analyzer import analyze_stock_technicals

@pytest.fixture
def mock_ohlcv_data():
    """Fixture for mock OHLCV data."""
    # Create a DataFrame with enough data to pass the length check in calculate_technical_indicators
    data_points = 200
    return {
        'AAPL': pd.DataFrame({
            'Open': [150] * data_points, 'High': [152] * data_points, 
            'Low': [149] * data_points, 'Close': [151] * data_points, 
            'Volume': [100000] * data_points
        }),
        'GOOG': pd.DataFrame({
            'Open': [2800] * data_points, 'High': [2820] * data_points, 
            'Low': [2790] * data_points, 'Close': [2810] * data_points, 
            'Volume': [50000] * data_points
        })
    }

@pytest.fixture
def mock_indicators():
    """Fixture for mock technical indicators."""
    return {
        "SMA_50": "150.50", "SMA_200": "145.20", "RSI": "65.30",
        "price_vs_SMA50": "above", "price_vs_SMA200": "above"
    }

@patch('stock_researcher.agents.technical_analyzer.calculate_technical_indicators')
@patch('stock_researcher.agents.technical_analyzer.fetch_ohlcv_data')
@patch('stock_researcher.agents.technical_analyzer.call_gemini_api')
def test_analyze_stock_technicals_success(mock_gemini_call, mock_fetch_data, mock_calc_indicators, mock_ohlcv_data, mock_indicators):
    """Test successful technical analysis generation."""
    # Arrange
    mock_fetch_data.return_value = mock_ohlcv_data
    mock_calc_indicators.return_value = mock_indicators
    mock_gemini_call.return_value = "The stock is in a strong uptrend."

    # Act
    tickers = ['AAPL', 'GOOG']
    summaries = analyze_stock_technicals(tickers)

    # Assert
    assert len(summaries) == 2
    assert summaries['AAPL'] == "The stock is in a strong uptrend."
    assert mock_fetch_data.call_count == 1
    assert mock_calc_indicators.call_count == 2
    assert mock_gemini_call.call_count == 2

@patch('stock_researcher.agents.technical_analyzer.fetch_ohlcv_data')
def test_analyze_stock_technicals_no_data(mock_fetch_data):
    """Test handling of tickers with no data."""
    # Arrange
    mock_fetch_data.return_value = {'AAPL': pd.DataFrame()}

    # Act
    summaries = analyze_stock_technicals(['AAPL'])

    # Assert
    assert summaries['AAPL'] == "No data available for technical analysis."

@patch('stock_researcher.agents.technical_analyzer.calculate_technical_indicators')
@patch('stock_researcher.agents.technical_analyzer.fetch_ohlcv_data')
@patch('stock_researcher.agents.technical_analyzer.call_gemini_api')
def test_analyze_stock_technicals_api_error(mock_gemini_call, mock_fetch_data, mock_calc_indicators, mock_ohlcv_data, mock_indicators):
    """Test handling of an API error during analysis."""
    # Arrange
    mock_fetch_data.return_value = mock_ohlcv_data
    mock_calc_indicators.return_value = mock_indicators
    mock_gemini_call.side_effect = Exception("API Failure")

    # Act
    summaries = analyze_stock_technicals(['AAPL'])

    # Assert
    assert "failed due to an API error" in summaries['AAPL']
