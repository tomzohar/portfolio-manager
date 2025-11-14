import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from stock_researcher.agents.technical_analyzer import analyze_stock_technicals

@pytest.fixture
def mock_ohlcv_data():
    """Fixture for mock OHLCV data."""
    data = {
        'AAPL': pd.DataFrame({
            'Open': [150], 'High': [152], 'Low': [149], 'Close': [151], 'Volume': [100000]
        }),
        'GOOG': pd.DataFrame({
            'Open': [2800], 'High': [2820], 'Low': [2790], 'Close': [2810], 'Volume': [50000]
        })
    }
    return data

@patch('stock_researcher.agents.technical_analyzer.fetch_ohlcv_data')
@patch('stock_researcher.agents.technical_analyzer.call_gemini_api')
def test_analyze_stock_technicals_success(mock_gemini_call, mock_fetch_data, mock_ohlcv_data):
    """Test successful technical analysis generation."""
    # Arrange
    mock_fetch_data.return_value = mock_ohlcv_data
    mock_gemini_call.return_value = "The stock is in a strong uptrend."

    # Act
    tickers = ['AAPL', 'GOOG']
    summaries = analyze_stock_technicals(tickers)

    # Assert
    assert len(summaries) == 2
    assert summaries['AAPL'] == "The stock is in a strong uptrend."
    assert summaries['GOOG'] == "The stock is in a strong uptrend."
    assert mock_fetch_data.call_count == 1
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

@patch('stock_researcher.agents.technical_analyzer.fetch_ohlcv_data')
@patch('stock_researcher.agents.technical_analyzer.call_gemini_api')
def test_analyze_stock_technicals_api_error(mock_gemini_call, mock_fetch_data, mock_ohlcv_data):
    """Test handling of an API error during analysis."""
    # Arrange
    mock_fetch_data.return_value = mock_ohlcv_data
    mock_gemini_call.side_effect = Exception("API Failure")

    # Act
    summaries = analyze_stock_technicals(['AAPL'])

    # Assert
    assert "failed due to an API error" in summaries['AAPL']
