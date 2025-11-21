
import os
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from polygon import RESTClient

from src.portfolio_manager.integrations.polygon import fetch_ohlcv_data


@pytest.fixture(autouse=True)
def disable_tenacity_retry(mocker):
    """Disable tenacity retry decorator for all tests to speed them up."""
    mocker.patch("src.portfolio_manager.integrations.polygon.retry", lambda *args, **kwargs: lambda f: f)


@pytest.fixture
def mock_settings_with_key(mocker):
    """Fixture to mock settings with a valid Polygon API key."""
    return mocker.patch(
        "src.portfolio_manager.integrations.polygon.settings",
        POLYGON_API_KEY="test_api_key",
    )


@pytest.fixture
def mock_settings_without_key(mocker):
    """Fixture to mock settings without a Polygon API key."""
    return mocker.patch(
        "src.portfolio_manager.integrations.polygon.settings", POLYGON_API_KEY=None
    )


@pytest.fixture
def mock_rest_client(mocker):
    """Fixture to mock the Polygon RESTClient."""
    mock_client = MagicMock(spec=RESTClient)
    mocker.patch(
        "src.portfolio_manager.integrations.polygon.RESTClient",
        return_value=mock_client,
    )
    return mock_client


def test_fetch_ohlcv_data_success(mock_settings_with_key, mock_rest_client):
    """
    Test successful fetching of OHLCV data for multiple tickers.
    """
    # Mock Polygon API response as a dictionary
    # This is how pandas.DataFrame can reliably create columns
    mock_agg_dict = {
        "open": 100,
        "high": 105,
        "low": 99,
        "close": 102,
        "volume": 10000,
        "timestamp": 1672531200000,  # 2023-01-01
    }
    
    mock_rest_client.get_aggs.return_value = [mock_agg_dict]

    tickers = ["AAPL", "GOOGL"]
    result = fetch_ohlcv_data(tickers, period="1y")

    assert result["success"] is True
    assert result["error"] is None
    assert "AAPL" in result["data"]
    assert "GOOGL" in result["data"]
    assert isinstance(result["data"]["AAPL"], pd.DataFrame)
    assert not result["data"]["AAPL"].empty
    assert list(result["data"]["AAPL"].columns) == [
        "Open",
        "High",
        "Low",
        "Close",
        "Volume",
    ]
    assert mock_rest_client.get_aggs.call_count == 2


def test_fetch_ohlcv_data_no_api_key(mock_settings_without_key):
    """
    Test that the function fails gracefully when no API key is provided.
    """
    result = fetch_ohlcv_data(["AAPL"], period="1y")

    assert result["success"] is False
    assert result["error"] == "Polygon API key is not configured."
    assert not result["data"]


def test_fetch_ohlcv_data_api_error(mock_settings_with_key, mock_rest_client):
    """
    Test handling of an API exception during data fetching.
    """
    mock_rest_client.get_aggs.side_effect = Exception("API limit reached")

    tickers = ["AAPL"]
    result = fetch_ohlcv_data(tickers, period="1y")

    assert result["success"] is True  # The overall function should succeed
    assert result["error"] is None
    assert "AAPL" in result["data"]
    assert result["data"]["AAPL"].empty  # DataFrame for the failed ticker should be empty


def test_fetch_ohlcv_data_no_data_for_ticker(mock_settings_with_key, mock_rest_client):
    """
    Test handling of a ticker for which the API returns no data.
    """
    mock_rest_client.get_aggs.return_value = []  # Simulate no data

    tickers = ["FAKE"]
    result = fetch_ohlcv_data(tickers, period="1y")

    assert result["success"] is True
    assert "FAKE" in result["data"]
    assert result["data"]["FAKE"].empty


def test_date_range_calculation(mock_settings_with_key, mock_rest_client):
    """
    Test that the date range is calculated and passed correctly to the API.
    """
    mock_rest_client.get_aggs.return_value = []
    
    today = datetime.now().date()
    one_year_ago = today - timedelta(days=365)
    
    fetch_ohlcv_data(["AAPL"], period="1y")
    
    mock_rest_client.get_aggs.assert_called_once()
    args, kwargs = mock_rest_client.get_aggs.call_args
    assert args[0] == "AAPL"
    assert args[3] == one_year_ago
    assert args[4] == today

    # Test 2 year period
    two_years_ago = today - timedelta(days=2 * 365)
    fetch_ohlcv_data(["AAPL"], period="2y")
    args, kwargs = mock_rest_client.get_aggs.call_args
    assert args[3] == two_years_ago

    # Test invalid period
    fetch_ohlcv_data(["AAPL"], period="invalid")
    args, _ = mock_rest_client.get_aggs.call_args
    assert args[3] == one_year_ago # defaults to 1 year

def test_critical_error_handling(mocker, mock_settings_with_key):
    """Test that critical errors (e.g., RESTClient instantiation) are caught."""
    mocker.patch(
        "src.portfolio_manager.integrations.polygon.RESTClient",
        side_effect=Exception("Invalid API Key")
    )

    result = fetch_ohlcv_data(["AAPL"])

    assert result["success"] is False
    assert result["error"] == "Invalid API Key"
    assert not result["data"]
