"""
Tests for Technical Analyzer Module

Comprehensive test suite for technical analysis functionality including
indicator calculation and LLM-based technical interpretation.

Author: Portfolio Manager Agent
Version: 1.0.0
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
from src.portfolio_manager.analysis.technical_analyzer import (
    calculate_technical_indicators,
    analyze_stock_technicals,
    _analyze_technicals_for_ticker,
    SYSTEM_INSTRUCTION,
)


@pytest.fixture
def sample_ohlcv_data():
    """Sample OHLCV DataFrame with sufficient data for indicator calculation."""
    data_points = 250  # More than 200 required for SMA-200
    return pd.DataFrame({
        'Open': [150.0 + i * 0.1 for i in range(data_points)],
        'High': [152.0 + i * 0.1 for i in range(data_points)],
        'Low': [149.0 + i * 0.1 for i in range(data_points)],
        'Close': [151.0 + i * 0.1 for i in range(data_points)],
        'Volume': [100000 + i * 100 for i in range(data_points)],
    })


@pytest.fixture
def sample_multi_ticker_ohlcv():
    """Multi-ticker OHLCV data for testing."""
    data_points = 250
    return {
        "AAPL": pd.DataFrame({
            'Open': [150] * data_points,
            'High': [152] * data_points,
            'Low': [149] * data_points,
            'Close': [151] * data_points,
            'Volume': [100000] * data_points,
        }),
        "GOOGL": pd.DataFrame({
            'Open': [2800] * data_points,
            'High': [2820] * data_points,
            'Low': [2790] * data_points,
            'Close': [2810] * data_points,
            'Volume': [50000] * data_points,
        }),
    }


@pytest.fixture
def sample_indicators():
    """Sample technical indicators for testing."""
    return {
        "SMA_50": "150.50",
        "SMA_200": "145.20",
        "RSI": "65.30",
        "MACD_line": "1.25",
        "MACD_signal": "0.85",
        "MACD_hist": "0.40",
        "price_vs_SMA50": "above",
        "price_vs_SMA200": "above",
    }


@pytest.fixture
def sample_technical_summary():
    """Sample LLM technical analysis response."""
    return "Stock shows bullish momentum with RSI at 65. Price above 50-day SMA indicates uptrend. MACD positive suggests continued strength."


class TestCalculateTechnicalIndicators:
    """Tests for calculate_technical_indicators function."""

    def test_calculate_indicators_success(self, sample_ohlcv_data):
        """Test successful calculation of technical indicators."""
        # Act
        indicators = calculate_technical_indicators(sample_ohlcv_data)
        
        # Assert
        assert "error" not in indicators
        assert "SMA_50" in indicators
        assert "SMA_200" in indicators
        assert "RSI" in indicators
        assert "MACD_line" in indicators
        assert "MACD_signal" in indicators
        assert "MACD_hist" in indicators
        assert "price_vs_SMA50" in indicators
        assert "price_vs_SMA200" in indicators
        
        # Verify values are formatted correctly
        assert isinstance(indicators["SMA_50"], str)
        assert isinstance(indicators["RSI"], str)

    def test_calculate_indicators_empty_dataframe(self):
        """Test handling of empty DataFrame."""
        # Arrange
        empty_df = pd.DataFrame()
        
        # Act
        indicators = calculate_technical_indicators(empty_df)
        
        # Assert
        assert "error" in indicators
        assert "Not enough historical data" in indicators["error"]

    def test_calculate_indicators_insufficient_data(self):
        """Test handling of DataFrame with insufficient data."""
        # Arrange
        small_df = pd.DataFrame({
            'Open': [150] * 50,
            'High': [152] * 50,
            'Low': [149] * 50,
            'Close': [151] * 50,
            'Volume': [100000] * 50,
        })
        
        # Act
        indicators = calculate_technical_indicators(small_df)
        
        # Assert
        assert "error" in indicators
        assert "Not enough historical data" in indicators["error"]

    def test_calculate_indicators_price_vs_sma(self, sample_ohlcv_data):
        """Test price vs SMA comparison logic."""
        # Act
        indicators = calculate_technical_indicators(sample_ohlcv_data)
        
        # Assert
        assert indicators["price_vs_SMA50"] in ["above", "below"]
        assert indicators["price_vs_SMA200"] in ["above", "below"]

    @patch("src.portfolio_manager.analysis.technical_analyzer.sentry_sdk")
    def test_calculate_indicators_exception_handling(self, mock_sentry):
        """Test exception handling and Sentry capture."""
        # Arrange - DataFrame that will cause calculation errors
        bad_df = pd.DataFrame({
            'Close': [None] * 250,  # All NaN values
        })
        
        # Act
        indicators = calculate_technical_indicators(bad_df)
        
        # Assert
        assert "error" in indicators
        assert mock_sentry.capture_exception.called

    def test_calculate_indicators_no_loops(self, sample_ohlcv_data):
        """Test that calculation uses vectorized operations (no loops)."""
        # This is a design verification test
        # The function should use pandas-ta vectorized operations
        # We verify by ensuring the function completes quickly
        import time
        
        start_time = time.time()
        indicators = calculate_technical_indicators(sample_ohlcv_data)
        elapsed = time.time() - start_time
        
        # Vectorized operations should complete in under 1 second
        assert elapsed < 1.0
        assert "error" not in indicators


class TestAnalyzeTechnicalsForTicker:
    """Tests for _analyze_technicals_for_ticker function."""

    @patch("src.portfolio_manager.analysis.technical_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    def test_analyze_ticker_success(self, mock_calc_indicators, mock_call_gemini, sample_ohlcv_data, sample_indicators, sample_technical_summary):
        """Test successful technical analysis for a single ticker."""
        # Arrange
        mock_calc_indicators.return_value = sample_indicators
        mock_call_gemini.return_value = sample_technical_summary
        
        # Act
        ticker, analysis = _analyze_technicals_for_ticker("AAPL", sample_ohlcv_data)
        
        # Assert
        assert ticker == "AAPL"
        assert "bullish momentum" in analysis
        assert len(analysis) > 0
        mock_calc_indicators.assert_called_once()
        mock_call_gemini.assert_called_once()

    def test_analyze_ticker_empty_dataframe(self):
        """Test handling of empty DataFrame."""
        # Arrange
        empty_df = pd.DataFrame()
        
        # Act
        ticker, analysis = _analyze_technicals_for_ticker("AAPL", empty_df)
        
        # Assert
        assert ticker == "AAPL"
        assert "No data available" in analysis

    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    def test_analyze_ticker_calculation_error(self, mock_calc_indicators, sample_ohlcv_data):
        """Test handling of indicator calculation errors."""
        # Arrange
        mock_calc_indicators.return_value = {"error": "Calculation failed"}
        
        # Act
        ticker, analysis = _analyze_technicals_for_ticker("AAPL", sample_ohlcv_data)
        
        # Assert
        assert ticker == "AAPL"
        assert "Calculation failed" in analysis

    @patch("src.portfolio_manager.analysis.technical_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    def test_analyze_ticker_api_error(self, mock_calc_indicators, mock_call_gemini, sample_ohlcv_data, sample_indicators):
        """Test handling of LLM API errors."""
        # Arrange
        mock_calc_indicators.return_value = sample_indicators
        mock_call_gemini.side_effect = Exception("API Timeout")
        
        # Act
        ticker, analysis = _analyze_technicals_for_ticker("AAPL", sample_ohlcv_data)
        
        # Assert
        assert ticker == "AAPL"
        assert "failed due to an API error" in analysis

    @patch("src.portfolio_manager.analysis.technical_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    @patch("src.portfolio_manager.analysis.technical_analyzer.sentry_sdk")
    def test_analyze_ticker_sentry_capture(self, mock_sentry, mock_calc_indicators, mock_call_gemini, sample_ohlcv_data, sample_indicators):
        """Test that exceptions are captured in Sentry."""
        # Arrange
        test_exception = Exception("API Error")
        mock_calc_indicators.return_value = sample_indicators
        mock_call_gemini.side_effect = test_exception
        
        # Act
        _analyze_technicals_for_ticker("AAPL", sample_ohlcv_data)
        
        # Assert
        mock_sentry.capture_exception.assert_called_once_with(test_exception)

    @patch("src.portfolio_manager.analysis.technical_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    def test_analyze_ticker_prompt_formatting(self, mock_calc_indicators, mock_call_gemini, sample_ohlcv_data, sample_indicators, sample_technical_summary):
        """Test that prompt is properly formatted with indicators."""
        # Arrange
        mock_calc_indicators.return_value = sample_indicators
        mock_call_gemini.return_value = sample_technical_summary
        
        # Act
        _analyze_technicals_for_ticker("AAPL", sample_ohlcv_data)
        
        # Assert
        prompt = mock_call_gemini.call_args[0][0]
        
        # Check system instruction is included
        assert SYSTEM_INSTRUCTION in prompt
        
        # Check indicators are in JSON format
        assert "```json" in prompt
        assert "SMA_50" in prompt
        assert "RSI" in prompt


class TestAnalyzeStockTechnicals:
    """Tests for analyze_stock_technicals function."""

    @patch("src.portfolio_manager.analysis.technical_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    @patch("src.portfolio_manager.analysis.technical_analyzer.fetch_ohlcv_data")
    def test_analyze_technicals_single_ticker(self, mock_fetch_data, mock_calc_indicators, mock_call_gemini, sample_ohlcv_data, sample_indicators, sample_technical_summary):
        """Test technical analysis for a single ticker."""
        # Arrange
        mock_fetch_data.return_value = {"success": True, "data": {"AAPL": sample_ohlcv_data}, "error": None}
        mock_calc_indicators.return_value = sample_indicators
        mock_call_gemini.return_value = sample_technical_summary
        
        # Act
        summaries = analyze_stock_technicals(["AAPL"])
        
        # Assert
        assert len(summaries) == 1
        assert "AAPL" in summaries
        assert "bullish momentum" in summaries["AAPL"]
        mock_fetch_data.assert_called_once_with(["AAPL"], period="1y")

    @patch("src.portfolio_manager.analysis.technical_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    @patch("src.portfolio_manager.analysis.technical_analyzer.fetch_ohlcv_data")
    def test_analyze_technicals_multiple_tickers(self, mock_fetch_data, mock_calc_indicators, mock_call_gemini, sample_multi_ticker_ohlcv, sample_indicators, sample_technical_summary):
        """Test technical analysis for multiple tickers."""
        # Arrange
        mock_fetch_data.return_value = {"success": True, "data": sample_multi_ticker_ohlcv, "error": None}
        mock_calc_indicators.return_value = sample_indicators
        mock_call_gemini.return_value = sample_technical_summary
        
        # Act
        summaries = analyze_stock_technicals(["AAPL", "GOOGL"])
        
        # Assert
        assert len(summaries) == 2
        assert "AAPL" in summaries
        assert "GOOGL" in summaries
        assert mock_call_gemini.call_count == 2

    def test_analyze_technicals_empty_list(self):
        """Test technical analysis with empty ticker list."""
        # Act
        summaries = analyze_stock_technicals([])
        
        # Assert
        assert summaries == {}

    @patch("src.portfolio_manager.analysis.technical_analyzer.fetch_ohlcv_data")
    def test_analyze_technicals_no_data(self, mock_fetch_data):
        """Test handling of tickers with no data."""
        # Arrange
        mock_fetch_data.return_value = {"success": True, "data": {"AAPL": pd.DataFrame()}, "error": None}
        
        # Act
        summaries = analyze_stock_technicals(["AAPL"])
        
        # Assert
        assert summaries["AAPL"] == "No data available for technical analysis."

    @patch("src.portfolio_manager.analysis.technical_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.technical_analyzer.calculate_technical_indicators")
    @patch("src.portfolio_manager.analysis.technical_analyzer.fetch_ohlcv_data")
    def test_analyze_technicals_partial_failure(self, mock_fetch_data, mock_calc_indicators, mock_call_gemini, sample_multi_ticker_ohlcv, sample_indicators, sample_technical_summary):
        """Test handling of partial failures (some tickers succeed, some fail)."""
        # Arrange
        mock_fetch_data.return_value = {"success": True, "data": sample_multi_ticker_ohlcv, "error": None}
        mock_calc_indicators.return_value = sample_indicators
        # First call succeeds, second fails
        mock_call_gemini.side_effect = [
            sample_technical_summary,
            Exception("API Error"),
        ]
        
        # Act
        summaries = analyze_stock_technicals(["AAPL", "GOOGL"])
        
        # Assert
        assert len(summaries) == 2
        assert "bullish momentum" in summaries["AAPL"]  # Success
        assert "failed due to an API error" in summaries["GOOGL"]  # Failure

    @patch("src.portfolio_manager.analysis.technical_analyzer.fetch_ohlcv_data")
    @patch("src.portfolio_manager.analysis.technical_analyzer.sentry_sdk")
    def test_analyze_technicals_fatal_error(self, mock_sentry, mock_fetch_data):
        """Test handling of fatal errors."""
        # Arrange
        mock_fetch_data.side_effect = Exception("Network Error")
        
        # Act
        summaries = analyze_stock_technicals(["AAPL"])
        
        # Assert
        assert isinstance(summaries, dict)
        assert mock_sentry.capture_exception.called

    @patch("src.portfolio_manager.analysis.technical_analyzer.ThreadPoolExecutor")
    @patch("src.portfolio_manager.analysis.technical_analyzer.fetch_ohlcv_data")
    def test_analyze_technicals_concurrent_execution(self, mock_fetch_data, mock_executor, sample_multi_ticker_ohlcv):
        """Test that analyses are performed concurrently."""
        # Arrange
        mock_fetch_data.return_value = {"success": True, "data": sample_multi_ticker_ohlcv, "error": None}
        mock_executor_instance = MagicMock()
        mock_executor.return_value.__enter__.return_value = mock_executor_instance
        
        # Create mock futures
        mock_future1 = MagicMock()
        mock_future1.result.return_value = ("AAPL", "Analysis 1")
        mock_future2 = MagicMock()
        mock_future2.result.return_value = ("GOOGL", "Analysis 2")
        
        mock_executor_instance.submit.side_effect = [mock_future1, mock_future2]
        
        # Act
        summaries = analyze_stock_technicals(["AAPL", "GOOGL"])
        
        # Assert
        # ThreadPoolExecutor was created with max_workers=2
        mock_executor.assert_called_once_with(max_workers=2)
        # Submit was called for each ticker
        assert mock_executor_instance.submit.call_count == 2


class TestSystemInstruction:
    """Tests for the SYSTEM_INSTRUCTION constant."""

    def test_system_instruction_not_empty(self):
        """Test that system instruction is defined."""
        assert SYSTEM_INSTRUCTION
        assert len(SYSTEM_INSTRUCTION) > 0

    def test_system_instruction_content(self):
        """Test that system instruction contains key elements."""
        assert "Technical Analyst" in SYSTEM_INSTRUCTION
        assert "technical indicators" in SYSTEM_INSTRUCTION
        assert "RSI" in SYSTEM_INSTRUCTION
        assert "momentum" in SYSTEM_INSTRUCTION

