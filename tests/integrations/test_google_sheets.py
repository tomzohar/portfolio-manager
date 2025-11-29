"""
Test Google Sheets Integration
Tests for portfolio parsing and price updates using mocks.
"""

from unittest.mock import MagicMock, patch

import pytest
from tenacity import RetryError

from src.portfolio_manager.integrations.google_sheets import (
    Portfolio,
    PortfolioPosition,
    _get_gspread_client,
    parse_portfolio,
    update_gsheet_prices,
)


@pytest.fixture
def mock_settings(mocker):
    """Mock configuration settings."""
    settings_mock = mocker.patch("src.portfolio_manager.integrations.google_sheets.settings")
    settings_mock.SPREADSHEET_ID = "test_sheet_id"
    settings_mock.SPREADSHEET_RANGE = "A:E"
    settings_mock.POLYGON_API_KEY = "test_api_key"
    settings_mock.GOOGLE_SERVICE_ACCOUNT_FILE = None
    
    # Mock the module-level get_google_creds function
    mocker.patch("src.portfolio_manager.integrations.google_sheets.get_google_creds", return_value={"type": "service_account"})
    
    return settings_mock


@pytest.fixture
def mock_gspread(mocker):
    """Mock gspread client and spreadsheet."""
    mock_client = MagicMock()
    mock_sheet = MagicMock()
    mock_client.open_by_key.return_value = mock_sheet
    
    # Mock gspread.authorize
    mocker.patch("src.portfolio_manager.integrations.google_sheets.gspread.authorize", return_value=mock_client)
    # Mock Credentials
    mocker.patch("src.portfolio_manager.integrations.google_sheets.Credentials.from_service_account_info")
    
    return mock_client, mock_sheet


def test_get_gspread_client(mock_settings, mock_gspread):
    """Test authentication client creation."""
    from src.portfolio_manager.integrations.google_sheets import get_google_creds
    
    client = _get_gspread_client()
    assert client is not None
    # Verify get_google_creds was called (it's mocked in fixture)
    get_google_creds.assert_called_once()


def test_parse_portfolio_success(mock_settings, mock_gspread):
    """Test successful portfolio parsing."""
    _, mock_sheet = mock_gspread
    
    # Mock spreadsheet data
    mock_data = {
        'values': [
            ['symbol', 'price', 'position', 'market value', '% of total', 'total'],
            ['AAPL', '150.00', '10', '1500.00', '50%', '3000.00'],
            ['GOOGL', '150.00', '10', '1500.00', '50%', '3000.00']
        ]
    }
    mock_sheet.values_get.return_value = mock_data

    portfolio = parse_portfolio()

    assert isinstance(portfolio, Portfolio)
    assert len(portfolio.positions) == 2
    assert portfolio.total_value == 3000.00
    
    pos1 = portfolio.positions[0]
    assert pos1.symbol == 'AAPL'
    assert pos1.price == 150.00
    assert pos1.position == 10
    assert pos1.market_value == 1500.00
    assert pos1.percent_of_total == 50.0


def test_parse_portfolio_missing_data(mock_settings, mock_gspread):
    """Test parsing with empty or missing data."""
    _, mock_sheet = mock_gspread
    mock_sheet.values_get.return_value = {'values': []}

    with pytest.raises(ValueError, match="No data found in spreadsheet or insufficient rows"):
        parse_portfolio()


def test_update_gsheet_prices_success(mock_settings, mock_gspread, mocker):
    """Test successful price updates."""
    _, mock_sheet = mock_gspread
    mock_worksheet = MagicMock()
    mock_sheet.worksheet.return_value = mock_worksheet
    
    # Mock existing tickers
    mock_worksheet.get.return_value = [
        ['symbol', 'price'],
        ['AAPL', '145.00'],
        ['GOOGL', '145.00']
    ]
    
    # Mock Polygon API
    mock_polygon = mocker.patch("src.portfolio_manager.integrations.google_sheets.RESTClient")
    mock_resp = MagicMock()
    mock_resp.close = 150.00
    mock_polygon.return_value.get_daily_open_close_agg.return_value = mock_resp

    update_gsheet_prices()
    
    # Verify update call
    assert mock_worksheet.update.called
    args, _ = mock_worksheet.update.call_args
    assert args[0] == 'B2:B3'
    assert args[1] == [['150.00'], ['150.00']]


def test_update_gsheet_prices_api_failure(mock_settings, mock_gspread, mocker):
    """Test price update handles API failures gracefully."""
    _, mock_sheet = mock_gspread
    mock_worksheet = MagicMock()
    mock_sheet.worksheet.return_value = mock_worksheet
    
    mock_worksheet.get.return_value = [
        ['symbol', 'price'],
        ['AAPL', '145.00']
    ]
    
    mock_polygon = mocker.patch("src.portfolio_manager.integrations.google_sheets.RESTClient")
    mock_polygon.return_value.get_daily_open_close_agg.side_effect = Exception("API Error")

    update_gsheet_prices()
    
    # Should update with original price on failure
    mock_worksheet.update.assert_called_with('B2:B2', [['145.00']])

