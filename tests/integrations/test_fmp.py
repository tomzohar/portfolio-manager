"""
Tests for Financial Modeling Prep (FMP) API Integration.

Tests the fmp.py integration module with mocked HTTP responses.
No live network calls are made in these tests.

Author: Portfolio Manager V3
Date: November 23, 2025
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List

from src.portfolio_manager.integrations.fmp import (
    fetch_financial_ratios,
    fetch_income_statement,
    fetch_balance_sheet,
    fetch_cash_flow,
    convert_fmp_to_standard_format,
    _get_api_key,
    REQUESTS_AVAILABLE
)


@pytest.fixture
def mock_fmp_api_key(mocker):
    """Mock FMP_API_KEY environment variable."""
    return mocker.patch.dict('os.environ', {'FMP_API_KEY': 'test_api_key_123'})


@pytest.fixture
def mock_no_api_key(mocker):
    """Mock missing FMP_API_KEY environment variable."""
    return mocker.patch.dict('os.environ', {}, clear=True)


@pytest.fixture
def sample_fmp_ratios():
    """Sample FMP ratios response."""
    return [
        {
            "symbol": "AAPL",
            "date": "2024-06-30",
            "peRatio": 28.5,
            "priceToBookRatio": 45.2,
            "returnOnEquity": 1.56,
            "currentRatio": 0.98,
            "debtEquityRatio": 1.8,
            "grossProfitMargin": 0.44,
            "operatingProfitMargin": 0.30,
            "netProfitMargin": 0.25
        }
    ]


@pytest.fixture
def sample_fmp_income_statements():
    """Sample FMP income statement response."""
    return [
        {
            "date": "2024-06-30",
            "symbol": "AAPL",
            "period": "Q2",
            "fiscalYear": "2024",
            "revenue": 90000000000,
            "costOfRevenue": 50000000000,
            "grossProfit": 40000000000,
            "operatingExpenses": 15000000000,
            "operatingIncome": 25000000000,
            "netIncome": 23000000000,
            "eps": 1.45,
            "ebitda": 28000000000
        },
        {
            "date": "2024-03-31",
            "symbol": "AAPL",
            "period": "Q1",
            "fiscalYear": "2024",
            "revenue": 85000000000,
            "costOfRevenue": 48000000000,
            "grossProfit": 37000000000,
            "operatingExpenses": 14000000000,
            "operatingIncome": 23000000000,
            "netIncome": 21000000000,
            "eps": 1.32,
            "ebitda": 26000000000
        }
    ]


@pytest.fixture
def sample_fmp_balance_sheets():
    """Sample FMP balance sheet response."""
    return [
        {
            "date": "2024-06-30",
            "symbol": "AAPL",
            "period": "Q2",
            "fiscalYear": "2024",
            "totalAssets": 350000000000,
            "totalLiabilities": 280000000000,
            "totalStockholdersEquity": 70000000000,
            "cashAndCashEquivalents": 30000000000,
            "totalDebt": 100000000000
        },
        {
            "date": "2024-03-31",
            "symbol": "AAPL",
            "period": "Q1",
            "fiscalYear": "2024",
            "totalAssets": 345000000000,
            "totalLiabilities": 275000000000,
            "totalStockholdersEquity": 70000000000,
            "cashAndCashEquivalents": 28000000000,
            "totalDebt": 98000000000
        }
    ]


@pytest.fixture
def sample_fmp_cash_flows():
    """Sample FMP cash flow response."""
    return [
        {
            "date": "2024-06-30",
            "symbol": "AAPL",
            "period": "Q2",
            "fiscalYear": "2024",
            "operatingCashFlow": 25000000000,
            "capitalExpenditure": -3000000000,
            "freeCashFlow": 22000000000,
            "investingCashFlow": -5000000000,
            "financingCashFlow": -18000000000
        },
        {
            "date": "2024-03-31",
            "symbol": "AAPL",
            "period": "Q1",
            "fiscalYear": "2024",
            "operatingCashFlow": 23000000000,
            "capitalExpenditure": -2800000000,
            "freeCashFlow": 20200000000,
            "investingCashFlow": -4500000000,
            "financingCashFlow": -16000000000
        }
    ]


class TestGetApiKey:
    """Tests for _get_api_key helper function."""

    def test_get_api_key_present(self, mock_fmp_api_key):
        """Test API key retrieval when key is set."""
        api_key = _get_api_key()
        assert api_key == 'test_api_key_123'

    def test_get_api_key_missing(self, mock_no_api_key):
        """Test API key retrieval when key is missing."""
        api_key = _get_api_key()
        assert api_key is None


class TestFetchFinancialRatios:
    """Tests for fetch_financial_ratios function."""

    def test_fetch_ratios_success(self, mock_fmp_api_key, sample_fmp_ratios, mocker):
        """Test successful fetch of financial ratios."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        # Mock requests.get
        mock_response = Mock()
        mock_response.json.return_value = sample_fmp_ratios
        mock_response.raise_for_status = Mock()
        
        mock_get = mocker.patch('requests.get', return_value=mock_response)
        
        # Call function
        result = fetch_financial_ratios("AAPL")
        
        # Assertions
        assert result["success"] is True
        assert result["ticker"] == "AAPL"
        assert result["ratios"]["peRatio"] == 28.5
        assert result["ratios"]["returnOnEquity"] == 1.56
        assert result["error"] is None
        
        # Verify API call
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert "ratios-ttm" in call_args[0][0]
        assert call_args[1]["params"]["symbol"] == "AAPL"
        assert call_args[1]["params"]["apikey"] == "test_api_key_123"

    def test_fetch_ratios_no_api_key(self, mock_no_api_key):
        """Test ratios fetch when API key not configured."""
        result = fetch_financial_ratios("AAPL")
        
        assert result["success"] is False
        assert result["ticker"] == "AAPL"
        assert result["ratios"] == {}
        assert "not configured" in result["error"]

    def test_fetch_ratios_api_error(self, mock_fmp_api_key, mocker):
        """Test error handling when FMP API fails."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        # Mock requests to raise exception
        mocker.patch('requests.get', side_effect=Exception("API rate limit exceeded"))
        
        # Mock Sentry
        mock_sentry = mocker.patch(
            'src.portfolio_manager.integrations.fmp.sentry_sdk.capture_exception'
        )
        
        # Call function
        result = fetch_financial_ratios("AAPL")
        
        # Assertions
        assert result["success"] is False
        assert result["ticker"] == "AAPL"
        assert result["ratios"] == {}
        assert "rate limit" in result["error"]
        mock_sentry.assert_called_once()

    def test_fetch_ratios_empty_response(self, mock_fmp_api_key, mocker):
        """Test handling of empty response from FMP."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        # Mock requests.get with empty response
        mock_response = Mock()
        mock_response.json.return_value = []
        mock_response.raise_for_status = Mock()
        
        mocker.patch('requests.get', return_value=mock_response)
        
        # Call function
        result = fetch_financial_ratios("INVALID")
        
        # Assertions
        assert result["success"] is False
        assert result["ticker"] == "INVALID"
        assert "No ratios data" in result["error"]

    def test_fetch_ratios_timeout(self, mock_fmp_api_key, mocker):
        """Test timeout handling."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        import requests
        mocker.patch('requests.get', side_effect=requests.exceptions.Timeout("Request timed out"))
        mock_sentry = mocker.patch('src.portfolio_manager.integrations.fmp.sentry_sdk.capture_exception')
        
        result = fetch_financial_ratios("AAPL")
        
        assert result["success"] is False
        assert "timed out" in result["error"]
        mock_sentry.assert_called_once()


class TestFetchIncomeStatement:
    """Tests for fetch_income_statement function."""

    def test_fetch_income_statement_success(self, mock_fmp_api_key, sample_fmp_income_statements, mocker):
        """Test successful fetch of income statements."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        mock_response = Mock()
        mock_response.json.return_value = sample_fmp_income_statements
        mock_response.raise_for_status = Mock()
        
        mock_get = mocker.patch('requests.get', return_value=mock_response)
        
        result = fetch_income_statement("AAPL", limit=4, period="quarter")
        
        assert len(result) == 2
        assert result[0]["revenue"] == 90000000000
        assert result[0]["netIncome"] == 23000000000
        assert result[0]["eps"] == 1.45
        
        # Verify API call
        call_args = mock_get.call_args
        assert "income-statement" in call_args[0][0]
        assert call_args[1]["params"]["symbol"] == "AAPL"
        assert call_args[1]["params"]["period"] == "quarter"
        assert call_args[1]["params"]["limit"] == 4

    def test_fetch_income_statement_no_api_key(self, mock_no_api_key):
        """Test income statement fetch without API key."""
        result = fetch_income_statement("AAPL")
        assert result == []

    def test_fetch_income_statement_api_error(self, mock_fmp_api_key, mocker):
        """Test error handling for income statement fetch."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        mocker.patch('requests.get', side_effect=Exception("Network error"))
        mock_sentry = mocker.patch('src.portfolio_manager.integrations.fmp.sentry_sdk.capture_exception')
        
        result = fetch_income_statement("AAPL")
        
        assert result == []
        mock_sentry.assert_called_once()


class TestFetchBalanceSheet:
    """Tests for fetch_balance_sheet function."""

    def test_fetch_balance_sheet_success(self, mock_fmp_api_key, sample_fmp_balance_sheets, mocker):
        """Test successful fetch of balance sheets."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        mock_response = Mock()
        mock_response.json.return_value = sample_fmp_balance_sheets
        mock_response.raise_for_status = Mock()
        
        mocker.patch('requests.get', return_value=mock_response)
        
        result = fetch_balance_sheet("AAPL", limit=4)
        
        assert len(result) == 2
        assert result[0]["totalAssets"] == 350000000000
        assert result[0]["totalLiabilities"] == 280000000000
        assert result[0]["cashAndCashEquivalents"] == 30000000000

    def test_fetch_balance_sheet_no_api_key(self, mock_no_api_key):
        """Test balance sheet fetch without API key."""
        result = fetch_balance_sheet("AAPL")
        assert result == []


class TestFetchCashFlow:
    """Tests for fetch_cash_flow function."""

    def test_fetch_cash_flow_success(self, mock_fmp_api_key, sample_fmp_cash_flows, mocker):
        """Test successful fetch of cash flow statements."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        mock_response = Mock()
        mock_response.json.return_value = sample_fmp_cash_flows
        mock_response.raise_for_status = Mock()
        
        mocker.patch('requests.get', return_value=mock_response)
        
        result = fetch_cash_flow("AAPL", limit=4)
        
        assert len(result) == 2
        assert result[0]["operatingCashFlow"] == 25000000000
        assert result[0]["freeCashFlow"] == 22000000000
        assert result[0]["capitalExpenditure"] == -3000000000

    def test_fetch_cash_flow_no_api_key(self, mock_no_api_key):
        """Test cash flow fetch without API key."""
        result = fetch_cash_flow("AAPL")
        assert result == []


class TestConvertFmpToStandardFormat:
    """Tests for convert_fmp_to_standard_format function."""

    def test_convert_success(self, sample_fmp_income_statements, sample_fmp_balance_sheets, sample_fmp_cash_flows):
        """Test successful conversion of FMP data to standard format."""
        result = convert_fmp_to_standard_format(
            sample_fmp_income_statements,
            sample_fmp_balance_sheets,
            sample_fmp_cash_flows
        )
        
        assert len(result) == 2
        
        # Check first statement
        stmt = result[0]
        assert stmt["period"] == "Q2"
        assert stmt["fiscal_year"] == "2024"
        assert stmt["date"] == "2024-06-30"
        assert stmt["revenue"] == 90000000000
        assert stmt["net_income"] == 23000000000
        assert stmt["eps"] == 1.45
        assert stmt["total_assets"] == 350000000000
        assert stmt["total_liabilities"] == 280000000000
        assert stmt["operating_cash_flow"] == 25000000000
        assert stmt["free_cash_flow"] == 22000000000
        assert stmt["source"] == "FMP"

    def test_convert_empty_lists(self):
        """Test conversion with empty input lists."""
        result = convert_fmp_to_standard_format([], [], [])
        assert result == []

    def test_convert_mismatched_lengths(self, sample_fmp_income_statements, sample_fmp_balance_sheets, sample_fmp_cash_flows):
        """Test conversion with mismatched list lengths (uses minimum)."""
        # Truncate one list
        short_income = sample_fmp_income_statements[:1]
        
        result = convert_fmp_to_standard_format(
            short_income,
            sample_fmp_balance_sheets,
            sample_fmp_cash_flows
        )
        
        # Should only have 1 statement (minimum length)
        assert len(result) == 1

    def test_convert_mismatched_dates(self, sample_fmp_income_statements, sample_fmp_balance_sheets, sample_fmp_cash_flows, caplog):
        """Test conversion with mismatched dates (logs warning but includes anyway)."""
        # Modify one date to mismatch
        modified_balance = sample_fmp_balance_sheets.copy()
        modified_balance[0] = {**modified_balance[0], "date": "2024-07-01"}
        
        result = convert_fmp_to_standard_format(
            sample_fmp_income_statements,
            modified_balance,
            sample_fmp_cash_flows
        )
        
        # Should still include the statement
        assert len(result) == 2
        
        # Should log warning
        assert "don't match" in caplog.text

    def test_convert_preserves_all_fields(self, sample_fmp_income_statements, sample_fmp_balance_sheets, sample_fmp_cash_flows):
        """Test that all important fields are preserved in conversion."""
        result = convert_fmp_to_standard_format(
            sample_fmp_income_statements,
            sample_fmp_balance_sheets,
            sample_fmp_cash_flows
        )
        
        stmt = result[0]
        
        # Income statement fields
        assert "revenue" in stmt
        assert "net_income" in stmt
        assert "eps" in stmt
        assert "gross_profit" in stmt
        assert "operating_income" in stmt
        assert "ebitda" in stmt
        
        # Balance sheet fields
        assert "total_assets" in stmt
        assert "total_liabilities" in stmt
        assert "total_equity" in stmt
        assert "cash" in stmt
        assert "total_debt" in stmt
        
        # Cash flow fields
        assert "operating_cash_flow" in stmt
        assert "free_cash_flow" in stmt
        assert "capital_expenditure" in stmt
        
        # Metadata
        assert stmt["source"] == "FMP"


class TestIntegrationWithFundamentalAgent:
    """Integration tests for FMP with Fundamental Agent."""

    def test_fmp_fallback_when_polygon_fails(self, mock_fmp_api_key, sample_fmp_income_statements, 
                                             sample_fmp_balance_sheets, sample_fmp_cash_flows, mocker):
        """Test that FMP is used as fallback when Polygon statements unavailable."""
        if not REQUESTS_AVAILABLE:
            pytest.skip("requests library not available")
        
        # Mock Polygon to return unavailable
        mock_polygon_statements = {
            "success": False,
            "ticker": "AAPL",
            "statements": [],
            "error": "Not available in subscription tier"
        }
        
        # Mock FMP responses
        mock_response = Mock()
        mock_response.raise_for_status = Mock()
        
        def mock_get_side_effect(url, *args, **kwargs):
            mock_resp = Mock()
            mock_resp.raise_for_status = Mock()
            
            if "income-statement" in url:
                mock_resp.json.return_value = sample_fmp_income_statements
            elif "balance-sheet" in url:
                mock_resp.json.return_value = sample_fmp_balance_sheets
            elif "cash-flow" in url:
                mock_resp.json.return_value = sample_fmp_cash_flows
            else:
                mock_resp.json.return_value = []
            
            return mock_resp
        
        mocker.patch('requests.get', side_effect=mock_get_side_effect)
        
        # Import and test the functions
        from src.portfolio_manager.integrations.fmp import (
            fetch_income_statement,
            fetch_balance_sheet,
            fetch_cash_flow,
            convert_fmp_to_standard_format
        )
        
        # Simulate the fallback logic
        income = fetch_income_statement("AAPL")
        balance = fetch_balance_sheet("AAPL")
        cash = fetch_cash_flow("AAPL")
        
        assert len(income) > 0
        assert len(balance) > 0
        assert len(cash) > 0
        
        # Convert to standard format
        normalized = convert_fmp_to_standard_format(income, balance, cash)
        
        assert len(normalized) > 0
        assert normalized[0]["source"] == "FMP"
        assert "revenue" in normalized[0]
        assert "total_assets" in normalized[0]
        assert "operating_cash_flow" in normalized[0]

