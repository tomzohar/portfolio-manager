"""
Tests for Polygon.io API Integration Module.

This module tests the polygon.py integration for fetching market data,
company fundamentals, and technical indicators from Polygon.io.

Author: Portfolio Manager V3
Date: November 22, 2025
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import pandas as pd
from polygon import RESTClient

from src.portfolio_manager.integrations.polygon import (
    fetch_ohlcv_data,
    fetch_ticker_details,
    fetch_market_benchmark,
    fetch_technical_indicators
)


class TestFetchOHLCVData:
    """Tests for fetch_ohlcv_data function."""

    def test_fetch_ohlcv_data_success(self, mocker):
        """
        Test successful fetch of OHLCV data for multiple tickers.
        
        Verifies that:
        - Legacy fetcher is called correctly
        - Success response is returned
        - Data is properly structured
        """
        # Create sample OHLCV data
        sample_dates = pd.date_range(start='2024-01-01', periods=10, freq='D')
        sample_data = {
            'AAPL': pd.DataFrame({
                'Open': [150.0 + i for i in range(10)],
                'High': [152.0 + i for i in range(10)],
                'Low': [149.0 + i for i in range(10)],
                'Close': [151.0 + i for i in range(10)],
                'Volume': [1000000 + i * 10000 for i in range(10)]
            }, index=sample_dates),
            'MSFT': pd.DataFrame({
                'Open': [350.0 + i for i in range(10)],
                'High': [352.0 + i for i in range(10)],
                'Low': [349.0 + i for i in range(10)],
                'Close': [351.0 + i for i in range(10)],
                'Volume': [800000 + i * 8000 for i in range(10)]
            }, index=sample_dates)
        }

        # Mock the legacy fetcher (must mock at import source)
        mock_legacy = mocker.patch(
            'src.stock_researcher.data_fetcher.ohlcv.fetch_ohlcv_data',
            return_value=sample_data
        )

        # Call function
        result = fetch_ohlcv_data(['AAPL', 'MSFT'], period='1y')

        # Assertions
        assert result['success'] is True
        assert 'AAPL' in result['data']
        assert 'MSFT' in result['data']
        assert isinstance(result['data']['AAPL'], pd.DataFrame)
        assert len(result['data']['AAPL']) == 10
        assert result['error'] is None
        mock_legacy.assert_called_once_with(['AAPL', 'MSFT'], '1y')

    def test_fetch_ohlcv_data_api_error(self, mocker):
        """
        Test error handling when Polygon API fails.
        
        Verifies that:
        - Exceptions are captured
        - Error response is returned
        - Sentry is notified
        """
        # Mock legacy fetcher to raise exception (must mock at import source)
        mock_legacy = mocker.patch(
            'src.stock_researcher.data_fetcher.ohlcv.fetch_ohlcv_data',
            side_effect=Exception("API rate limit exceeded")
        )

        # Mock Sentry
        mock_sentry = mocker.patch(
            'src.portfolio_manager.integrations.polygon.sentry_sdk.capture_exception'
        )

        # Call function
        result = fetch_ohlcv_data(['AAPL'], period='1y')

        # Assertions
        assert result['success'] is False
        assert result['data'] == {}
        assert 'API rate limit exceeded' in result['error']
        mock_sentry.assert_called_once()

    def test_fetch_ohlcv_data_empty_result(self, mocker):
        """
        Test handling of tickers with no data.
        
        Verifies graceful handling when a ticker has no historical data.
        """
        # Mock legacy fetcher with empty DataFrame for one ticker
        sample_dates = pd.date_range(start='2024-01-01', periods=10, freq='D')
        sample_data = {
            'AAPL': pd.DataFrame({
                'Open': [150.0 + i for i in range(10)],
                'High': [152.0 + i for i in range(10)],
                'Low': [149.0 + i for i in range(10)],
                'Close': [151.0 + i for i in range(10)],
                'Volume': [1000000 + i * 10000 for i in range(10)]
            }, index=sample_dates),
            'INVALID': pd.DataFrame()  # Empty DataFrame
        }

        mocker.patch(
            'src.stock_researcher.data_fetcher.ohlcv.fetch_ohlcv_data',
            return_value=sample_data
        )

        # Call function
        result = fetch_ohlcv_data(['AAPL', 'INVALID'], period='1y')

        # Assertions
        assert result['success'] is True
        assert 'AAPL' in result['data']
        assert 'INVALID' in result['data']
        assert len(result['data']['AAPL']) == 10
        assert len(result['data']['INVALID']) == 0  # Empty DataFrame


class TestFetchTickerDetails:
    """Tests for fetch_ticker_details function."""

    def test_fetch_ticker_details_success(self, mocker):
        """
        Test successful fetch of ticker fundamental data.
        
        Verifies that:
        - Polygon API is called correctly
        - All expected fields are present
        - Success response is returned
        """
        # Mock Polygon API response
        mock_response = Mock()
        mock_response.name = 'Apple Inc.'
        mock_response.market_cap = 2800000000000  # $2.8T
        mock_response.share_class_shares_outstanding = 15500000000
        mock_response.description = 'Apple Inc. designs, manufactures, and markets smartphones...'
        mock_response.sic_description = 'Technology'
        mock_response.primary_exchange = 'XNAS'
        mock_response.total_employees = 164000
        mock_response.homepage_url = 'https://www.apple.com'

        # Mock RESTClient
        mock_client = Mock(spec=RESTClient)
        mock_client.get_ticker_details.return_value = mock_response
        
        mocker.patch(
            'src.portfolio_manager.integrations.polygon.RESTClient',
            return_value=mock_client
        )

        # Mock settings with API key
        mocker.patch(
            'src.portfolio_manager.integrations.polygon.settings.POLYGON_API_KEY',
            'test_polygon_key'
        )

        # Call function
        result = fetch_ticker_details('AAPL')

        # Assertions
        assert result['success'] is True
        assert result['ticker'] == 'AAPL'
        assert result['name'] == 'Apple Inc.'
        assert result['market_cap'] == 2800000000000
        assert result['shares_outstanding'] == 15500000000
        assert result['sector'] == 'Technology'
        assert result['exchange'] == 'XNAS'
        assert result['employees'] == 164000
        assert result['homepage_url'] == 'https://www.apple.com'
        assert result['error'] is None
        mock_client.get_ticker_details.assert_called_once_with('AAPL')

    def test_fetch_ticker_details_ticker_not_found(self, mocker):
        """
        Test error handling when ticker is not found.
        
        Verifies that:
        - Exception is handled gracefully
        - Error response is returned
        - Sentry is notified
        """
        # Mock RESTClient to raise exception
        mock_client = Mock(spec=RESTClient)
        mock_client.get_ticker_details.side_effect = Exception("Ticker not found")
        
        mocker.patch(
            'src.portfolio_manager.integrations.polygon.RESTClient',
            return_value=mock_client
        )

        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.polygon.settings.POLYGON_API_KEY',
            'test_polygon_key'
        )

        # Mock Sentry
        mock_sentry = mocker.patch(
            'src.portfolio_manager.integrations.polygon.sentry_sdk.capture_exception'
        )

        # Call function
        result = fetch_ticker_details('INVALID')

        # Assertions
        assert result['success'] is False
        assert result['ticker'] == 'INVALID'
        assert 'Ticker not found' in result['error']
        mock_sentry.assert_called_once()

    def test_fetch_ticker_details_missing_optional_fields(self, mocker):
        """
        Test handling of response with missing optional fields.
        
        Verifies that:
        - Function handles None values gracefully
        - Warning is logged for missing critical fields
        - Partial data is still returned
        """
        # Mock response with some None fields
        mock_response = Mock()
        mock_response.name = 'Test Company'
        mock_response.market_cap = None  # Missing critical field
        mock_response.share_class_shares_outstanding = None
        mock_response.description = None
        mock_response.sic_description = 'Technology'
        mock_response.primary_exchange = 'XNAS'
        mock_response.total_employees = None
        mock_response.homepage_url = None

        mock_client = Mock(spec=RESTClient)
        mock_client.get_ticker_details.return_value = mock_response
        
        mocker.patch(
            'src.portfolio_manager.integrations.polygon.RESTClient',
            return_value=mock_client
        )

        mocker.patch(
            'src.portfolio_manager.integrations.polygon.settings.POLYGON_API_KEY',
            'test_polygon_key'
        )

        # Mock logger to verify warning
        mock_logger = mocker.patch(
            'src.portfolio_manager.integrations.polygon.logger'
        )

        # Call function
        result = fetch_ticker_details('TEST')

        # Assertions
        assert result['success'] is True
        assert result['ticker'] == 'TEST'
        assert result['name'] == 'Test Company'
        assert result['market_cap'] is None
        assert result['sector'] == 'Technology'
        mock_logger.warning.assert_called_once()
        assert 'market_cap' in mock_logger.warning.call_args[0][0]

    def test_fetch_ticker_details_no_api_key(self, mocker):
        """
        Test that error is raised when POLYGON_API_KEY is not configured.
        
        Verifies error handling when API key is missing from both
        settings and environment.
        """
        # Mock settings without POLYGON_API_KEY
        mock_settings = Mock(spec=[])
        mocker.patch(
            'src.portfolio_manager.integrations.polygon.settings',
            mock_settings
        )

        # Mock environment without POLYGON_API_KEY
        mocker.patch.dict('os.environ', {}, clear=True)

        # Mock Sentry
        mock_sentry = mocker.patch(
            'src.portfolio_manager.integrations.polygon.sentry_sdk.capture_exception'
        )

        # Call function
        result = fetch_ticker_details('AAPL')

        # Assertions
        assert result['success'] is False
        assert 'POLYGON_API_KEY' in result['error']
        mock_sentry.assert_called_once()


class TestFetchMarketBenchmark:
    """Tests for fetch_market_benchmark function."""

    def test_fetch_market_benchmark_success(self, mocker):
        """
        Test successful fetch of SPY benchmark data.
        
        Verifies that:
        - fetch_ohlcv_data is called with ['SPY']
        - SPY DataFrame is extracted correctly
        - Success response is returned
        """
        # Create sample SPY data
        sample_dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
        spy_df = pd.DataFrame({
            'Open': [450.0 + i * 0.1 for i in range(252)],
            'High': [452.0 + i * 0.1 for i in range(252)],
            'Low': [449.0 + i * 0.1 for i in range(252)],
            'Close': [451.0 + i * 0.1 for i in range(252)],
            'Volume': [80000000 + i * 10000 for i in range(252)]
        }, index=sample_dates)

        # Mock fetch_ohlcv_data
        mock_fetch = mocker.patch(
            'src.portfolio_manager.integrations.polygon.fetch_ohlcv_data',
            return_value={
                'success': True,
                'data': {'SPY': spy_df},
                'error': None
            }
        )

        # Call function
        result = fetch_market_benchmark(period='1y')

        # Assertions
        assert result['success'] is True
        assert isinstance(result['data'], pd.DataFrame)
        assert len(result['data']) == 252
        assert 'Close' in result['data'].columns
        assert result['error'] is None
        mock_fetch.assert_called_once_with(['SPY'], period='1y')

    def test_fetch_market_benchmark_spy_unavailable(self, mocker):
        """
        Test error handling when SPY data is unavailable.
        
        Verifies graceful handling when market benchmark cannot be fetched.
        """
        # Mock fetch_ohlcv_data to return empty DataFrame
        mock_fetch = mocker.patch(
            'src.portfolio_manager.integrations.polygon.fetch_ohlcv_data',
            return_value={
                'success': True,
                'data': {'SPY': pd.DataFrame()},  # Empty DataFrame
                'error': None
            }
        )

        # Call function
        result = fetch_market_benchmark(period='2y')

        # Assertions
        assert result['success'] is False
        assert isinstance(result['data'], pd.DataFrame)
        assert len(result['data']) == 0
        assert 'No data available for SPY' in result['error']

    def test_fetch_market_benchmark_api_error(self, mocker):
        """
        Test error handling when underlying API call fails.
        
        Verifies that errors from fetch_ohlcv_data are propagated correctly.
        """
        # Mock fetch_ohlcv_data to return error
        mock_fetch = mocker.patch(
            'src.portfolio_manager.integrations.polygon.fetch_ohlcv_data',
            return_value={
                'success': False,
                'data': {},
                'error': 'API connection timeout'
            }
        )

        # Call function
        result = fetch_market_benchmark(period='1y')

        # Assertions
        assert result['success'] is False
        assert isinstance(result['data'], pd.DataFrame)
        assert len(result['data']) == 0
        assert 'API connection timeout' in result['error']

    def test_fetch_market_benchmark_exception(self, mocker):
        """
        Test exception handling in fetch_market_benchmark.
        
        Verifies that unexpected exceptions are handled gracefully.
        """
        # Mock fetch_ohlcv_data to raise exception
        mock_fetch = mocker.patch(
            'src.portfolio_manager.integrations.polygon.fetch_ohlcv_data',
            side_effect=Exception("Unexpected error")
        )

        # Mock Sentry
        mock_sentry = mocker.patch(
            'src.portfolio_manager.integrations.polygon.sentry_sdk.capture_exception'
        )

        # Call function
        result = fetch_market_benchmark(period='1y')

        # Assertions
        assert result['success'] is False
        assert isinstance(result['data'], pd.DataFrame)
        assert 'Unexpected error' in result['error']
        mock_sentry.assert_called_once()


class TestFetchTechnicalIndicators:
    """Tests for fetch_technical_indicators function (Phase 2 placeholder)."""

    def test_fetch_technical_indicators_placeholder(self, mocker):
        """
        Test that placeholder function returns empty DataFrame.
        
        This is a Phase 2 feature. Currently just verifies the
        function exists and returns empty DataFrame as documented.
        """
        # Mock logger to verify warning
        mock_logger = mocker.patch(
            'src.portfolio_manager.integrations.polygon.logger'
        )

        # Call function
        result = fetch_technical_indicators(
            ticker='AAPL',
            indicator='sma',
            window=50
        )

        # Assertions
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0  # Empty DataFrame
        mock_logger.warning.assert_called_once()
        assert 'not yet implemented' in mock_logger.warning.call_args[0][0]


# Fixtures

@pytest.fixture
def sample_ticker_details():
    """
    Fixture providing sample ticker details response.
    
    Returns a dictionary matching the expected structure from
    fetch_ticker_details() for use in integration tests.
    """
    return {
        'success': True,
        'ticker': 'AAPL',
        'name': 'Apple Inc.',
        'market_cap': 2800000000000,
        'shares_outstanding': 15500000000,
        'description': 'Apple Inc. designs and manufactures consumer electronics.',
        'sector': 'Technology',
        'industry': 'Technology',
        'exchange': 'XNAS',
        'employees': 164000,
        'homepage_url': 'https://www.apple.com',
        'error': None
    }


@pytest.fixture
def sample_ohlcv_data():
    """
    Fixture providing sample OHLCV DataFrame.
    
    Returns a DataFrame with realistic stock price data for testing.
    """
    dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
    return pd.DataFrame({
        'Open': [150.0 + i * 0.1 for i in range(252)],
        'High': [152.0 + i * 0.1 for i in range(252)],
        'Low': [149.0 + i * 0.1 for i in range(252)],
        'Close': [151.0 + i * 0.1 for i in range(252)],
        'Volume': [1000000 + i * 1000 for i in range(252)]
    }, index=dates)

