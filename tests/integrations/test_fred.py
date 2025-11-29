"""
Tests for FRED API Integration Module.

This module tests the fred.py integration for fetching macroeconomic data
from the Federal Reserve Economic Data (FRED) API.

Author: Portfolio Manager V3
Date: November 21, 2025
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
import pandas as pd
from fredapi import Fred

from src.portfolio_manager.integrations.fred import (
    fetch_fred_series,
    fetch_macro_indicators,
    get_risk_free_rate
)


class TestFetchFredSeries:
    """Tests for fetch_fred_series function."""

    def test_fetch_fred_series_success(self, mocker):
        """
        Test successful fetch of a FRED series.
        
        Verifies that:
        - FRED API is called with correct parameters
        - A pandas Series is returned
        - Logging occurs correctly
        """
        # Create sample data
        sample_dates = pd.date_range(start='2023-01-01', periods=12, freq='MS')
        sample_values = [100.0 + i for i in range(12)]
        expected_series = pd.Series(sample_values, index=sample_dates)

        # Mock settings to include FRED_API_KEY
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Spy on Fred class and mock get_series method
        mock_fred_instance = Mock(spec=Fred)
        mock_fred_instance.get_series.return_value = expected_series
        mock_fred_class = mocker.patch(
            'src.portfolio_manager.integrations.fred.Fred',
            return_value=mock_fred_instance
        )

        # Disable retry for testing speed
        mocker.patch(
            'src.portfolio_manager.integrations.fred.fetch_fred_series.retry.stop',
            None
        )

        # Call function
        result = fetch_fred_series('CPIAUCSL', observation_start='2023-01-01')

        # Assertions
        assert isinstance(result, pd.Series)
        assert len(result) == 12
        mock_fred_class.assert_called_once_with(api_key='test_api_key')
        mock_fred_instance.get_series.assert_called_once_with(
            'CPIAUCSL',
            observation_start='2023-01-01',
            observation_end=mocker.ANY  # Accept any end date
        )

    def test_fetch_fred_series_no_api_key(self, mocker):
        """
        Test that ValueError is raised when FRED_API_KEY is not configured.
        
        Verifies error handling when API key is missing.
        """
        # Mock settings without FRED_API_KEY
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings',
            spec=['GEMINI_API_KEY']  # Settings without FRED_API_KEY
        )

        # Should raise error (wrapped in RetryError due to @retry decorator)
        from tenacity import RetryError
        with pytest.raises((ValueError, RetryError)) as exc_info:
            fetch_fred_series('CPIAUCSL')

        # Check the error message (may be in the original exception or wrapped)
        error_str = str(exc_info.value)
        assert "FRED_API_KEY" in error_str or "RetryError" in error_str

    def test_fetch_fred_series_with_date_range(self, mocker):
        """
        Test that custom date ranges are passed correctly to FRED API.
        
        Verifies that observation_start and observation_end parameters
        are properly forwarded to the Fred.get_series() call.
        """
        # Sample data
        sample_series = pd.Series([1.0, 2.0, 3.0])

        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Mock Fred instance
        mock_fred_instance = Mock(spec=Fred)
        mock_fred_instance.get_series.return_value = sample_series
        mocker.patch(
            'src.portfolio_manager.integrations.fred.Fred',
            return_value=mock_fred_instance
        )

        # Call with custom date range
        start_date = '2023-01-01'
        end_date = '2023-12-31'
        result = fetch_fred_series(
            'GDP',
            observation_start=start_date,
            observation_end=end_date
        )

        # Verify dates passed correctly
        mock_fred_instance.get_series.assert_called_once_with(
            'GDP',
            observation_start=start_date,
            observation_end=end_date
        )
        assert isinstance(result, pd.Series)

    def test_fetch_fred_series_api_error(self, mocker):
        """
        Test error handling when FRED API request fails.
        
        Verifies that:
        - Exceptions from FRED API are caught and logged
        - Sentry capture is called
        - Exception is re-raised after retries
        """
        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Mock Fred to raise exception
        mock_fred_instance = Mock(spec=Fred)
        mock_fred_instance.get_series.side_effect = Exception("API connection error")
        mocker.patch(
            'src.portfolio_manager.integrations.fred.Fred',
            return_value=mock_fred_instance
        )

        # Mock sentry
        mock_sentry = mocker.patch('src.portfolio_manager.integrations.fred.sentry_sdk')

        # Should raise exception after retries (wrapped in RetryError)
        from tenacity import RetryError
        with pytest.raises((Exception, RetryError)) as exc_info:
            fetch_fred_series('INVALID_SERIES')

        # Verify exception occurred (either direct or wrapped in RetryError)
        # The retry decorator will have attempted multiple times
        assert exc_info.value is not None
        
        # Verify Sentry was called (should be called on each retry)
        assert mock_sentry.capture_exception.called
        # Should be called 5 times (number of retry attempts)
        assert mock_sentry.capture_exception.call_count == 5


class TestFetchMacroIndicators:
    """Tests for fetch_macro_indicators batch fetcher function."""

    def test_fetch_macro_indicators_success(self, mocker):
        """
        Test successful fetch of all macro indicators.
        
        Verifies that all 5 indicators (CPI, GDP, yield curve, unemployment, VIX)
        are fetched with correct series IDs.
        """
        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Create sample data for each series
        sample_series = pd.Series([100.0, 101.0, 102.0])

        # Mock fetch_fred_series to return sample data
        mock_fetch = mocker.patch(
            'src.portfolio_manager.integrations.fred.fetch_fred_series',
            return_value=sample_series
        )

        # Call function
        result = fetch_macro_indicators(lookback_days=365)

        # Verify all indicators present
        expected_indicators = ["cpi", "gdp", "yield_curve", "unemployment", "vix"]
        assert set(result.keys()) == set(expected_indicators)

        # Verify each indicator is a pandas Series
        for indicator_name, data in result.items():
            assert isinstance(data, pd.Series)

        # Verify fetch_fred_series was called 5 times (once per indicator)
        assert mock_fetch.call_count == 5

        # Verify correct series IDs were used
        series_ids_called = [call[1]['series_id'] for call in mock_fetch.call_args_list]
        expected_series_ids = ['CPIAUCSL', 'GDP', 'T10Y2Y', 'UNRATE', 'VIXCLS']
        assert set(series_ids_called) == set(expected_series_ids)

    def test_fetch_macro_indicators_partial_failure(self, mocker):
        """
        Test graceful handling when some indicators fail to fetch.
        
        Verifies that:
        - Function continues even if one series fails
        - Partial data is returned for successful series
        - Failed series are logged as warnings
        - Sentry captures failed attempts
        """
        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Sample successful data
        sample_series = pd.Series([100.0, 101.0, 102.0])

        # Mock fetch_fred_series to fail for VIX, succeed for others
        def mock_fetch_side_effect(series_id, **kwargs):
            if series_id == 'VIXCLS':
                raise Exception("VIX data unavailable")
            return sample_series

        mock_fetch = mocker.patch(
            'src.portfolio_manager.integrations.fred.fetch_fred_series',
            side_effect=mock_fetch_side_effect
        )

        # Mock sentry
        mock_sentry = mocker.patch('src.portfolio_manager.integrations.fred.sentry_sdk')

        # Call function
        result = fetch_macro_indicators(lookback_days=365)

        # Verify partial data returned (4 out of 5 indicators)
        assert len(result) == 4
        assert "cpi" in result
        assert "gdp" in result
        assert "yield_curve" in result
        assert "unemployment" in result
        assert "vix" not in result  # VIX should be excluded

        # Verify Sentry was called for the failure
        assert mock_sentry.capture_exception.called


class TestGetRiskFreeRate:
    """Tests for get_risk_free_rate utility function."""

    def test_get_risk_free_rate_success(self, mocker):
        """
        Test successful fetch of risk-free rate.
        
        Verifies that:
        - 10Y Treasury yield is fetched (DGS10 series)
        - Rate is converted from percentage to decimal
        - Latest non-null value is returned
        """
        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Create sample treasury data (FRED returns percentages)
        # E.g., 4.5% is stored as 4.5 in FRED
        sample_dates = pd.date_range(start='2024-10-01', periods=5, freq='D')
        sample_values = [4.5, 4.55, None, 4.6, 4.58]  # Include None to test dropna
        treasury_series = pd.Series(sample_values, index=sample_dates)

        # Mock fetch_fred_series
        mock_fetch = mocker.patch(
            'src.portfolio_manager.integrations.fred.fetch_fred_series',
            return_value=treasury_series
        )

        # Call function
        result = get_risk_free_rate()

        # Assertions
        assert isinstance(result, float)
        
        # Should return 4.58 / 100 = 0.0458 (latest non-null value)
        expected_rate = 4.58 / 100.0
        assert result == pytest.approx(expected_rate, rel=1e-6)

        # Verify DGS10 series was fetched
        mock_fetch.assert_called_once()
        call_kwargs = mock_fetch.call_args[1]
        assert call_kwargs['series_id'] == 'DGS10'

    def test_get_risk_free_rate_api_error(self, mocker):
        """
        Test error handling when risk-free rate fetch fails.
        
        Verifies that exceptions are properly caught, logged to Sentry,
        and re-raised.
        """
        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Mock fetch_fred_series to raise exception
        mocker.patch(
            'src.portfolio_manager.integrations.fred.fetch_fred_series',
            side_effect=Exception("Treasury data unavailable")
        )

        # Mock sentry
        mock_sentry = mocker.patch('src.portfolio_manager.integrations.fred.sentry_sdk')

        # Should raise exception
        with pytest.raises(Exception) as exc_info:
            get_risk_free_rate()

        assert "Treasury data unavailable" in str(exc_info.value)
        
        # Verify Sentry was called
        assert mock_sentry.capture_exception.called


class TestIntegration:
    """Integration tests with more realistic scenarios."""

    def test_default_date_range_calculation(self, mocker):
        """
        Test that default date range (1 year lookback) is calculated correctly.
        
        Verifies the default observation_start is set to 1 year ago when not provided.
        """
        # Mock settings
        mocker.patch(
            'src.portfolio_manager.integrations.fred.settings.FRED_API_KEY',
            'test_api_key'
        )

        # Sample data
        sample_series = pd.Series([100.0, 101.0])

        # Mock Fred instance
        mock_fred_instance = Mock(spec=Fred)
        mock_fred_instance.get_series.return_value = sample_series
        mocker.patch(
            'src.portfolio_manager.integrations.fred.Fred',
            return_value=mock_fred_instance
        )

        # Call without date parameters
        fetch_fred_series('CPIAUCSL')

        # Verify observation_start is approximately 1 year ago
        call_kwargs = mock_fred_instance.get_series.call_args[1]
        observation_start = call_kwargs['observation_start']
        
        # Parse the date string
        start_date = datetime.strptime(observation_start, '%Y-%m-%d')
        expected_date = datetime.now() - timedelta(days=365)
        
        # Allow 1 day tolerance
        assert abs((start_date - expected_date).days) <= 1

