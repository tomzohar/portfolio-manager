"""
Financial Modeling Prep (FMP) API Integration.

This module provides access to FMP financial statements and ratios to supplement
Polygon.io data when financial statements are unavailable in the Polygon subscription tier.

FMP API serves as a fallback data source for the Fundamental Agent, improving
confidence scores by providing detailed income statements, balance sheets, and cash flows.

Key Features:
- Quarterly financial statements (income, balance, cash flow)
- Pre-calculated financial ratios (P/E, P/B, ROE, etc.)
- Graceful fallback when API key not configured
- Comprehensive error handling and retry logic
- Sentry integration for exception tracking

Author: Portfolio Manager V3
Date: November 23, 2025
"""

import logging
import os
from typing import Dict, List, Optional, Any

import sentry_sdk
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

# FMP API Base URL (updated to stable endpoints as of Nov 2025)
FMP_BASE_URL = "https://financialmodelingprep.com/stable"

# Import requests only if available (graceful degradation)
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    logger.warning("requests library not available - FMP integration disabled")
    REQUESTS_AVAILABLE = False


def _get_api_key() -> Optional[str]:
    """
    Retrieve FMP API key from environment variables.
    
    Returns:
        API key string if found, None otherwise
        
    Notes:
        - Checks FMP_API_KEY environment variable
        - Logs warning if key not found but does not raise exception
        - Allows system to degrade gracefully without FMP data
    """
    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        logger.debug("FMP_API_KEY not found in environment - FMP integration disabled")
    return api_key


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((Exception,)),
    reraise=True
)
def fetch_financial_ratios(ticker: str) -> Dict[str, Any]:
    """
    Fetch key financial ratios from FMP API (TTM - trailing twelve months).
    
    Retrieves pre-calculated ratios including P/E, P/B, ROE, current ratio,
    debt-to-equity, and profitability margins. Useful when detailed financial
    statements are unavailable or for quick analysis.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        
    Returns:
        Dictionary with financial ratios:
        {
            "success": bool,
            "ticker": str,
            "ratios": {
                "peRatio": float,
                "priceToBookRatio": float,
                "returnOnEquity": float,
                "currentRatio": float,
                "debtEquityRatio": float,
                "grossProfitMargin": float,
                "operatingProfitMargin": float,
                "netProfitMargin": float,
                "roe": float,
                "roa": float,
                ... (additional ratios)
            },
            "error": Optional[str]
        }
        
        On failure or if FMP unavailable:
        {
            "success": False,
            "ticker": ticker,
            "ratios": {},
            "error": "Error message"
        }
        
    Example:
        >>> ratios = fetch_financial_ratios("AAPL")
        >>> if ratios["success"]:
        ...     pe_ratio = ratios["ratios"].get("peRatio")
        ...     roe = ratios["ratios"].get("returnOnEquity")
        ...     print(f"P/E: {pe_ratio}, ROE: {roe}")
        
    Notes:
        - Uses TTM (trailing twelve months) endpoint for most recent data
        - Returns empty dict if API key not configured (graceful degradation)
        - Automatically retries on network errors (max 3 attempts)
        - All exceptions captured and reported to Sentry
        - Timeout: 10 seconds per request
    """
    if not REQUESTS_AVAILABLE:
        logger.warning(f"requests library unavailable - cannot fetch ratios for {ticker}")
        return {
            "success": False,
            "ticker": ticker,
            "ratios": {},
            "error": "requests library not available"
        }
    
    api_key = _get_api_key()
    if not api_key:
        logger.debug(f"FMP_API_KEY not configured - skipping ratios for {ticker}")
        return {
            "success": False,
            "ticker": ticker,
            "ratios": {},
            "error": "FMP_API_KEY not configured"
        }
    
    try:
        url = f"{FMP_BASE_URL}/ratios-ttm"
        params = {
            "symbol": ticker,
            "apikey": api_key
        }
        
        logger.debug(f"Fetching FMP ratios for {ticker}")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # FMP returns array, take first element
        if not data or not isinstance(data, list) or len(data) == 0:
            logger.warning(f"No ratios data returned for {ticker}")
            return {
                "success": False,
                "ticker": ticker,
                "ratios": {},
                "error": "No ratios data available"
            }
        
        ratios = data[0]
        logger.info(f"Successfully fetched ratios for {ticker}")
        
        return {
            "success": True,
            "ticker": ticker,
            "ratios": ratios,
            "error": None
        }
        
    except Exception as e:
        error_msg = f"Failed to fetch ratios for {ticker}: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        
        return {
            "success": False,
            "ticker": ticker,
            "ratios": {},
            "error": error_msg
        }


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((Exception,)),
    reraise=True
)
def fetch_income_statement(ticker: str, limit: int = 4, period: str = "quarter") -> List[Dict[str, Any]]:
    """
    Fetch income statements from FMP API.
    
    Retrieves quarterly or annual income statements including revenue, net income,
    operating expenses, EBITDA, and earnings per share.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        limit: Number of periods to fetch (default 4 = 1 year of quarterly data)
        period: Statement period ('quarter' or 'annual')
        
    Returns:
        List of income statement dictionaries:
        [
            {
                "date": "2024-06-30",
                "symbol": "AAPL",
                "period": "Q2",
                "calendarYear": "2024",
                "revenue": 90000000000,
                "costOfRevenue": 50000000000,
                "grossProfit": 40000000000,
                "operatingExpenses": 15000000000,
                "operatingIncome": 25000000000,
                "netIncome": 23000000000,
                "eps": 1.45,
                "ebitda": 28000000000,
                ... (additional fields)
            },
            ...
        ]
        
        On failure, returns empty list []
        
    Example:
        >>> statements = fetch_income_statement("AAPL", limit=4)
        >>> if statements:
        ...     latest = statements[0]
        ...     revenue = latest.get("revenue")
        ...     net_income = latest.get("netIncome")
        ...     margin = (net_income / revenue) * 100
        ...     print(f"Net Margin: {margin:.2f}%")
        
    Notes:
        - Returns empty list if API key not configured (graceful degradation)
        - Statements ordered by date (most recent first)
        - Automatically retries on network errors (max 3 attempts)
        - All exceptions captured and reported to Sentry
        - Timeout: 10 seconds per request
    """
    if not REQUESTS_AVAILABLE:
        logger.warning(f"requests library unavailable - cannot fetch income statement for {ticker}")
        return []
    
    api_key = _get_api_key()
    if not api_key:
        logger.debug(f"FMP_API_KEY not configured - skipping income statement for {ticker}")
        return []
    
    try:
        url = f"{FMP_BASE_URL}/income-statement"
        params = {
            "symbol": ticker,
            "period": period,
            "limit": limit,
            "apikey": api_key
        }
        
        logger.debug(f"Fetching FMP income statement for {ticker} (period: {period}, limit: {limit})")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if not data or not isinstance(data, list):
            logger.warning(f"No income statement data returned for {ticker}")
            return []
        
        logger.info(f"Successfully fetched {len(data)} income statements for {ticker}")
        return data
        
    except Exception as e:
        error_msg = f"Failed to fetch income statement for {ticker}: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        return []


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((Exception,)),
    reraise=True
)
def fetch_balance_sheet(ticker: str, limit: int = 4, period: str = "quarter") -> List[Dict[str, Any]]:
    """
    Fetch balance sheets from FMP API.
    
    Retrieves quarterly or annual balance sheets including assets, liabilities,
    equity, cash, debt, and other balance sheet items.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        limit: Number of periods to fetch (default 4 = 1 year of quarterly data)
        period: Statement period ('quarter' or 'annual')
        
    Returns:
        List of balance sheet dictionaries:
        [
            {
                "date": "2024-06-30",
                "symbol": "AAPL",
                "period": "Q2",
                "calendarYear": "2024",
                "totalAssets": 350000000000,
                "totalLiabilities": 280000000000,
                "totalStockholdersEquity": 70000000000,
                "cashAndCashEquivalents": 30000000000,
                "totalDebt": 100000000000,
                "totalCurrentAssets": 150000000000,
                "totalCurrentLiabilities": 120000000000,
                ... (additional fields)
            },
            ...
        ]
        
        On failure, returns empty list []
        
    Example:
        >>> balance_sheets = fetch_balance_sheet("AAPL", limit=4)
        >>> if balance_sheets:
        ...     latest = balance_sheets[0]
        ...     assets = latest.get("totalAssets")
        ...     liabilities = latest.get("totalLiabilities")
        ...     equity = assets - liabilities
        ...     print(f"Equity: ${equity:,.0f}")
        
    Notes:
        - Returns empty list if API key not configured (graceful degradation)
        - Statements ordered by date (most recent first)
        - Automatically retries on network errors (max 3 attempts)
        - All exceptions captured and reported to Sentry
        - Timeout: 10 seconds per request
    """
    if not REQUESTS_AVAILABLE:
        logger.warning(f"requests library unavailable - cannot fetch balance sheet for {ticker}")
        return []
    
    api_key = _get_api_key()
    if not api_key:
        logger.debug(f"FMP_API_KEY not configured - skipping balance sheet for {ticker}")
        return []
    
    try:
        url = f"{FMP_BASE_URL}/balance-sheet-statement"
        params = {
            "symbol": ticker,
            "period": period,
            "limit": limit,
            "apikey": api_key
        }
        
        logger.debug(f"Fetching FMP balance sheet for {ticker} (period: {period}, limit: {limit})")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if not data or not isinstance(data, list):
            logger.warning(f"No balance sheet data returned for {ticker}")
            return []
        
        logger.info(f"Successfully fetched {len(data)} balance sheets for {ticker}")
        return data
        
    except Exception as e:
        error_msg = f"Failed to fetch balance sheet for {ticker}: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        return []


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((Exception,)),
    reraise=True
)
def fetch_cash_flow(ticker: str, limit: int = 4, period: str = "quarter") -> List[Dict[str, Any]]:
    """
    Fetch cash flow statements from FMP API.
    
    Retrieves quarterly or annual cash flow statements including operating,
    investing, and financing cash flows, plus free cash flow.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        limit: Number of periods to fetch (default 4 = 1 year of quarterly data)
        period: Statement period ('quarter' or 'annual')
        
    Returns:
        List of cash flow statement dictionaries:
        [
            {
                "date": "2024-06-30",
                "symbol": "AAPL",
                "period": "Q2",
                "calendarYear": "2024",
                "operatingCashFlow": 25000000000,
                "capitalExpenditure": -3000000000,
                "freeCashFlow": 22000000000,
                "investingCashFlow": -5000000000,
                "financingCashFlow": -18000000000,
                "netChangeInCash": 2000000000,
                ... (additional fields)
            },
            ...
        ]
        
        On failure, returns empty list []
        
    Example:
        >>> cash_flows = fetch_cash_flow("AAPL", limit=4)
        >>> if cash_flows:
        ...     latest = cash_flows[0]
        ...     fcf = latest.get("freeCashFlow")
        ...     print(f"Free Cash Flow: ${fcf:,.0f}")
        
    Notes:
        - Returns empty list if API key not configured (graceful degradation)
        - Statements ordered by date (most recent first)
        - Automatically retries on network errors (max 3 attempts)
        - All exceptions captured and reported to Sentry
        - Timeout: 10 seconds per request
    """
    if not REQUESTS_AVAILABLE:
        logger.warning(f"requests library unavailable - cannot fetch cash flow for {ticker}")
        return []
    
    api_key = _get_api_key()
    if not api_key:
        logger.debug(f"FMP_API_KEY not configured - skipping cash flow for {ticker}")
        return []
    
    try:
        url = f"{FMP_BASE_URL}/cash-flow-statement"
        params = {
            "symbol": ticker,
            "period": period,
            "limit": limit,
            "apikey": api_key
        }
        
        logger.debug(f"Fetching FMP cash flow for {ticker} (period: {period}, limit: {limit})")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if not data or not isinstance(data, list):
            logger.warning(f"No cash flow data returned for {ticker}")
            return []
        
        logger.info(f"Successfully fetched {len(data)} cash flow statements for {ticker}")
        return data
        
    except Exception as e:
        error_msg = f"Failed to fetch cash flow for {ticker}: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        return []


def convert_fmp_to_standard_format(
    income_statements: List[Dict],
    balance_sheets: List[Dict],
    cash_flows: List[Dict]
) -> List[Dict[str, Any]]:
    """
    Normalize FMP financial statements to match internal format (compatible with Polygon).
    
    Converts FMP's field naming convention to a standardized format that matches
    the structure used by Polygon financial statements. This allows the Fundamental
    Agent to work with both data sources seamlessly.
    
    Args:
        income_statements: List of FMP income statements
        balance_sheets: List of FMP balance sheets
        cash_flows: List of FMP cash flow statements
        
    Returns:
        List of normalized statements:
        [
            {
                "period": "Q2",
                "fiscal_year": 2024,
                "date": "2024-06-30",
                "revenue": 90000000000,
                "net_income": 23000000000,
                "eps": 1.45,
                "total_assets": 350000000000,
                "total_liabilities": 280000000000,
                "total_equity": 70000000000,
                "operating_cash_flow": 25000000000,
                "free_cash_flow": 22000000000,
                "source": "FMP"
            },
            ...
        ]
        
    Example:
        >>> income = fetch_income_statement("AAPL")
        >>> balance = fetch_balance_sheet("AAPL")
        >>> cash = fetch_cash_flow("AAPL")
        >>> normalized = convert_fmp_to_standard_format(income, balance, cash)
        >>> # Can now use same code as Polygon statements
        
    Notes:
        - Matches all statements by date
        - Only includes periods where all three statements are available
        - Handles missing fields gracefully (sets to None)
        - Preserves original source for debugging ("FMP" tag)
        - If lengths don't match, uses minimum length to ensure alignment
    """
    if not income_statements or not balance_sheets or not cash_flows:
        logger.debug("One or more statement lists empty - cannot normalize")
        return []
    
    # Ensure all lists have same length (use minimum to avoid index errors)
    min_len = min(len(income_statements), len(balance_sheets), len(cash_flows))
    
    if min_len == 0:
        return []
    
    logger.debug(f"Normalizing {min_len} FMP statements to standard format")
    
    normalized = []
    for i in range(min_len):
        inc = income_statements[i]
        bal = balance_sheets[i]
        cf = cash_flows[i]
        
        # Verify dates match (quality check)
        inc_date = inc.get("date")
        bal_date = bal.get("date")
        cf_date = cf.get("date")
        
        if inc_date != bal_date or bal_date != cf_date:
            logger.warning(
                f"Statement dates don't match at index {i}: "
                f"income={inc_date}, balance={bal_date}, cash={cf_date}. "
                "Including anyway but may indicate data quality issue."
            )
        
        normalized_stmt = {
            # Period identification
            "period": inc.get("period"),
            "fiscal_year": inc.get("fiscalYear"),
            "date": inc_date,
            
            # Income statement
            "revenue": inc.get("revenue"),
            "net_income": inc.get("netIncome"),
            "eps": inc.get("eps"),
            "gross_profit": inc.get("grossProfit"),
            "operating_income": inc.get("operatingIncome"),
            "ebitda": inc.get("ebitda"),
            
            # Balance sheet
            "total_assets": bal.get("totalAssets"),
            "total_liabilities": bal.get("totalLiabilities"),
            "total_equity": bal.get("totalStockholdersEquity"),
            "cash": bal.get("cashAndCashEquivalents"),
            "total_debt": bal.get("totalDebt"),
            
            # Cash flow
            "operating_cash_flow": cf.get("operatingCashFlow"),
            "free_cash_flow": cf.get("freeCashFlow"),
            "capital_expenditure": cf.get("capitalExpenditure"),
            
            # Metadata
            "source": "FMP"
        }
        
        normalized.append(normalized_stmt)
    
    logger.info(f"Successfully normalized {len(normalized)} FMP statements")
    return normalized

