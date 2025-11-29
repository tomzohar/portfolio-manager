"""
Polygon.io Integration for Portfolio Manager.

Provides access to Polygon.io APIs for:
- OHLCV market data
- Company fundamental data (Reference Data API)
- Technical indicators (built-in calculations)
- Benchmark data for risk calculations

All functions include retry logic, error handling, and Sentry integration
per architectural mandates.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pandas as pd
import sentry_sdk
from polygon import RESTClient
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings

logger = logging.getLogger(__name__)


@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=60))
def fetch_ohlcv_data(
    tickers: List[str],
    period: str = "1y"
) -> Dict[str, Dict[str, pd.DataFrame] | bool | Optional[str]]:
    """
    Fetch historical OHLCV data for a list of stock tickers using Polygon API.
    
    This function wraps the legacy OHLCV fetcher to provide a portfolio_manager
    interface with retry logic and proper error handling.
    
    Args:
        tickers: List of stock ticker symbols (e.g., ['AAPL', 'MSFT'])
        period: Historical period to fetch (e.g., '1y', '2y')
            Format: '{n}y' where n is number of years
    
    Returns:
        Dictionary with structure:
        {
            "success": bool,
            "data": {
                "AAPL": pd.DataFrame(columns=['Open', 'High', 'Low', 'Close', 'Volume']),
                "MSFT": pd.DataFrame(...),
                ...
            },
            "error": Optional[str]
        }
        
        On failure, returns:
        {
            "success": False,
            "data": {},
            "error": "Error message"
        }
    
    Example:
        >>> result = fetch_ohlcv_data(["AAPL"], period="1y")
        >>> if result["success"]:
        ...     df = result["data"]["AAPL"]
        ...     print(f"Fetched {len(df)} data points")
    
    Notes:
        - Uses Polygon API client (requires POLYGON_API_KEY in environment)
        - Returns empty DataFrame for tickers with no data
        - Automatically retries on API failures (5 attempts max)
        - All exceptions captured and reported to Sentry
    """
    logger.info(f"Fetching OHLCV data for {len(tickers)} tickers (period: {period})")
    
    try:
        # Parse period string (e.g., "1y" -> 1 year)
        years = int(period.rstrip('y'))
        end_date = datetime.now()
        start_date = end_date - timedelta(days=years * 365)
        
        # Initialize Polygon REST client
        api_key = getattr(settings, 'POLYGON_API_KEY', None)
        if not api_key:
            import os
            api_key = os.getenv('POLYGON_API_KEY')
            if not api_key:
                raise ValueError("POLYGON_API_KEY not found in settings or environment")
        
        client = RESTClient(api_key)
        
        # Fetch data for each ticker
        ohlcv_data = {}
        for ticker in tickers:
            try:
                # Fetch aggregates (daily bars) from Polygon
                aggs = client.get_aggs(
                    ticker=ticker,
                    multiplier=1,
                    timespan="day",
                    from_=start_date.strftime("%Y-%m-%d"),
                    to=end_date.strftime("%Y-%m-%d")
                )
                
                # Convert to pandas DataFrame
                if aggs and len(aggs) > 0:
                    data = []
                    for agg in aggs:
                        data.append({
                            'Open': agg.open,
                            'High': agg.high,
                            'Low': agg.low,
                            'Close': agg.close,
                            'Volume': agg.volume,
                        })
                    
                    df = pd.DataFrame(data)
                    # Set index to timestamps
                    timestamps = [datetime.fromtimestamp(agg.timestamp / 1000) for agg in aggs]
                    df.index = pd.DatetimeIndex(timestamps)
                    ohlcv_data[ticker] = df
                    logger.info(f"Fetched {len(df)} data points for {ticker}")
                else:
                    # Empty DataFrame for ticker with no data
                    ohlcv_data[ticker] = pd.DataFrame()
                    logger.warning(f"No data returned for {ticker}")
                    
            except Exception as ticker_error:
                logger.warning(f"Failed to fetch data for {ticker}: {str(ticker_error)}")
                ohlcv_data[ticker] = pd.DataFrame()
        
        logger.info(f"Successfully fetched OHLCV data for {len(ohlcv_data)} tickers")
        
        return {
            "success": True,
            "data": ohlcv_data,
            "error": None
        }
        
    except Exception as e:
        error_msg = f"Failed to fetch OHLCV data: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        
        return {
            "success": False,
            "data": {},
            "error": error_msg
        }


@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=60))
def fetch_ticker_details(ticker: str) -> Dict:
    """
    Fetch company fundamental data from Polygon.io Reference Data API.
    
    Retrieves company information including market cap, sector, description,
    and other fundamental data points used by the Fundamental Agent.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
    
    Returns:
        Dictionary with company fundamentals:
        {
            "success": bool,
            "ticker": str,
            "name": str,
            "market_cap": float,
            "shares_outstanding": int,
            "description": str,
            "sector": str,
            "industry": str,
            "exchange": str,
            "employees": int,
            "homepage_url": str,
            "error": Optional[str]
        }
        
        On failure or missing ticker, returns:
        {
            "success": False,
            "ticker": ticker,
            "error": "Error message"
        }
    
    Example:
        >>> details = fetch_ticker_details("AAPL")
        >>> if details["success"]:
        ...     print(f"Market Cap: ${details['market_cap']:,.0f}")
        ...     print(f"Sector: {details['sector']}")
    
    Notes:
        - Uses Polygon Reference Data API (v3)
        - Handles missing optional fields gracefully
        - Logs warnings for incomplete data
        - Automatically retries on API failures (5 attempts max)
    """
    logger.info(f"Fetching ticker details for {ticker}")
    
    try:
        # Initialize Polygon REST client
        # Note: polygon-api-client automatically uses POLYGON_API_KEY env var
        # We're explicitly passing it from settings for consistency
        api_key = getattr(settings, 'POLYGON_API_KEY', None)
        if not api_key:
            # Fallback: try to use from environment (polygon client default behavior)
            import os
            api_key = os.getenv('POLYGON_API_KEY')
            if not api_key:
                raise ValueError(
                    "POLYGON_API_KEY not found in settings or environment. "
                    "Please configure Polygon API key in .env file."
                )
        
        client = RESTClient(api_key)
        
        # Fetch ticker details from Polygon API
        details_response = client.get_ticker_details(ticker)
        
        # Extract data with graceful handling of missing fields
        result = {
            "success": True,
            "ticker": ticker,
            "name": getattr(details_response, 'name', None),
            "market_cap": getattr(details_response, 'market_cap', None),
            "shares_outstanding": getattr(
                details_response, 
                'share_class_shares_outstanding', 
                None
            ),
            "description": getattr(details_response, 'description', None),
            "sector": getattr(details_response, 'sic_description', None),
            "industry": getattr(details_response, 'sic_description', None),  # Polygon uses SIC for both
            "exchange": getattr(details_response, 'primary_exchange', None),
            "employees": getattr(details_response, 'total_employees', None),
            "homepage_url": getattr(details_response, 'homepage_url', None),
            "error": None
        }
        
        # Log warnings for missing critical fields
        missing_fields = []
        if result["market_cap"] is None:
            missing_fields.append("market_cap")
        if result["name"] is None:
            missing_fields.append("name")
        
        if missing_fields:
            logger.warning(
                f"Ticker {ticker}: Missing fields {missing_fields}. "
                "Data may be incomplete."
            )
        
        logger.info(f"Successfully fetched details for {ticker}")
        return result
        
    except Exception as e:
        error_msg = f"Failed to fetch ticker details for {ticker}: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        
        return {
            "success": False,
            "ticker": ticker,
            "error": error_msg
        }


def fetch_market_benchmark(period: str = "1y") -> Dict[str, pd.DataFrame | bool | Optional[str]]:
    """
    Fetch S&P 500 (SPY) data for beta calculation and risk assessment.
    
    This is a convenience wrapper around fetch_ohlcv_data() specifically for
    fetching the market benchmark (S&P 500) used by the Risk Agent.
    
    Args:
        period: Historical period (e.g., '1y', '2y')
            Default: '1y' (one year of data)
    
    Returns:
        Dictionary with structure:
        {
            "success": bool,
            "data": pd.DataFrame(columns=['Open', 'High', 'Low', 'Close', 'Volume']),
            "error": Optional[str]
        }
        
        On failure, returns:
        {
            "success": False,
            "data": pd.DataFrame(),  # Empty DataFrame
            "error": "Error message"
        }
    
    Example:
        >>> result = fetch_market_benchmark(period="2y")
        >>> if result["success"]:
        ...     spy_data = result["data"]
        ...     returns = spy_data['Close'].pct_change()
    
    Notes:
        - Used by Risk Agent for beta calculation
        - SPY is used as proxy for S&P 500 market returns
        - Automatically retries via fetch_ohlcv_data retry logic
    """
    logger.info(f"Fetching market benchmark (SPY) for period: {period}")
    
    try:
        # Fetch SPY data using existing OHLCV fetcher
        result = fetch_ohlcv_data(["SPY"], period=period)
        
        if not result["success"]:
            return {
                "success": False,
                "data": pd.DataFrame(),
                "error": result.get("error", "Unknown error fetching SPY data")
            }
        
        # Extract SPY DataFrame from dict
        spy_data = result["data"].get("SPY", pd.DataFrame())
        
        if spy_data.empty:
            logger.warning("SPY data is empty - market benchmark unavailable")
            return {
                "success": False,
                "data": pd.DataFrame(),
                "error": "No data available for SPY"
            }
        
        logger.info(f"Successfully fetched {len(spy_data)} data points for SPY")
        
        return {
            "success": True,
            "data": spy_data,
            "error": None
        }
        
    except Exception as e:
        error_msg = f"Failed to fetch market benchmark: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        
        return {
            "success": False,
            "data": pd.DataFrame(),
            "error": error_msg
        }


@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=60))
def fetch_financial_statements(ticker: str, limit: int = 4) -> Dict:
    """
    Fetch financial statements from Polygon.io Financials API.
    
    Attempts to retrieve quarterly income statements, balance sheets, and cash flows
    for fundamental analysis. Note: Availability depends on Polygon subscription tier.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        limit: Number of quarters to fetch (default 4 = 1 year)
            Maximum: 100 (API limit)
    
    Returns:
        Dictionary with structure:
        {
            "success": bool,
            "ticker": str,
            "statements": [
                {
                    "period": str (e.g., "Q1", "Q2"),
                    "fiscal_year": int,
                    "fiscal_period": str,
                    "start_date": str,
                    "end_date": str,
                    "filing_date": str,
                    "revenue": float,
                    "net_income": float,
                    "total_assets": float,
                    "total_liabilities": float,
                    "operating_cash_flow": float,
                    "eps": float,
                    "gross_profit": float
                },
                ...
            ],
            "count": int,
            "error": Optional[str]
        }
        
        On failure or if data unavailable (e.g., subscription tier restriction):
        {
            "success": False,
            "ticker": ticker,
            "statements": [],
            "count": 0,
            "error": "Error message or 'Not available in subscription tier'"
        }
    
    Example:
        >>> result = fetch_financial_statements("AAPL", limit=4)
        >>> if result["success"] and result["statements"]:
        ...     latest = result["statements"][0]
        ...     print(f"Revenue: ${latest['revenue']:,.0f}")
    
    Notes:
        - Financials API may not be available in all Polygon subscription tiers
        - Graceful fallback: Returns success=False if unavailable
        - Uses quarterly statements (most granular available)
        - Fundamental Agent should handle missing statements gracefully
        - Automatically retries on API failures (5 attempts max)
    """
    logger.info(f"Fetching financial statements for {ticker} (limit: {limit})")
    
    try:
        # Initialize Polygon REST client
        api_key = getattr(settings, 'POLYGON_API_KEY', None)
        if not api_key:
            import os
            api_key = os.getenv('POLYGON_API_KEY')
            if not api_key:
                raise ValueError("POLYGON_API_KEY not found")
        
        client = RESTClient(api_key)
        
        # Fetch financial statements
        # Note: list_ticker_financials() may not be available in all subscription tiers
        try:
            financials_response = client.list_ticker_financials(
                ticker=ticker,
                limit=limit
            )
        except AttributeError:
            # Method doesn't exist in this version of polygon-api-client
            logger.warning(f"Financial statements API not available for {ticker}")
            return {
                "success": False,
                "ticker": ticker,
                "statements": [],
                "count": 0,
                "error": "Financial statements API not available in client library"
            }
        
        # Process response into structured format
        statements = []
        for financial in financials_response:
            try:
                # Extract data with safe access
                income_statement = getattr(financial, 'financials', {}).get('income_statement', {})
                balance_sheet = getattr(financial, 'financials', {}).get('balance_sheet', {})
                cash_flow = getattr(financial, 'financials', {}).get('cash_flow_statement', {})
                
                statement = {
                    "period": getattr(financial, 'fiscal_period', None),
                    "fiscal_year": getattr(financial, 'fiscal_year', None),
                    "fiscal_period": getattr(financial, 'fiscal_period', None),
                    "start_date": getattr(financial, 'start_date', None),
                    "end_date": getattr(financial, 'end_date', None),
                    "filing_date": getattr(financial, 'filing_date', None),
                    # Income statement
                    "revenue": income_statement.get('revenues', {}).get('value', None),
                    "net_income": income_statement.get('net_income_loss', {}).get('value', None),
                    "gross_profit": income_statement.get('gross_profit', {}).get('value', None),
                    "eps": income_statement.get('basic_earnings_per_share', {}).get('value', None),
                    # Balance sheet
                    "total_assets": balance_sheet.get('assets', {}).get('value', None),
                    "total_liabilities": balance_sheet.get('liabilities', {}).get('value', None),
                    # Cash flow
                    "operating_cash_flow": cash_flow.get(
                        'net_cash_flow_from_operating_activities', 
                        {}
                    ).get('value', None),
                }
                
                statements.append(statement)
            except (AttributeError, KeyError) as e:
                logger.warning(f"Error parsing financial statement: {e}")
                continue
        
        if not statements:
            logger.warning(
                f"No financial statements found for {ticker}. "
                "This may indicate the ticker is not available or subscription tier limitation."
            )
            return {
                "success": False,
                "ticker": ticker,
                "statements": [],
                "count": 0,
                "error": "No financial statements available (may be subscription tier limitation)"
            }
        
        logger.info(f"Successfully fetched {len(statements)} financial statements for {ticker}")
        
        return {
            "success": True,
            "ticker": ticker,
            "statements": statements,
            "count": len(statements),
            "error": None
        }
        
    except Exception as e:
        error_msg = f"Failed to fetch financial statements for {ticker}: {str(e)}"
        logger.error(error_msg)
        sentry_sdk.capture_exception(e)
        
        return {
            "success": False,
            "ticker": ticker,
            "statements": [],
            "count": 0,
            "error": error_msg
        }


def fetch_technical_indicators(
    ticker: str,
    indicator: str,
    timespan: str = "day",
    window: int = 50,
    limit: int = 120
) -> pd.DataFrame:
    """
    Fetch pre-calculated technical indicators from Polygon.io.
    
    **NOTE:** This is a PLACEHOLDER for Phase 2 implementation.
    
    Polygon.io offers built-in technical indicator calculations which are
    faster and more reliable than local pandas-ta calculations. This function
    will be implemented in Phase 2 when the Technical Agent is refactored.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        indicator: Indicator type ('sma', 'ema', 'rsi', 'macd')
        timespan: Time period ('day', 'hour', etc.)
        window: Indicator window/period (e.g., 50 for SMA-50)
        limit: Number of data points to return
    
    Returns:
        DataFrame with indicator values (currently returns empty DataFrame)
    
    Supported Indicators (for Phase 2):
        - 'sma': Simple Moving Average
        - 'ema': Exponential Moving Average
        - 'rsi': Relative Strength Index
        - 'macd': Moving Average Convergence Divergence
        - 'bbands': Bollinger Bands
        - 'stoch': Stochastic Oscillator
        - 'adx': Average Directional Index
    
    API Endpoint (Phase 2):
        GET /v1/indicators/{indicator_type}/{ticker}
    
    Example (Phase 2):
        >>> sma_data = fetch_technical_indicators("AAPL", "sma", window=50)
        >>> print(sma_data.tail())
    
    TODO: Implement in Phase 2 (Technical Agent refactoring)
          See MANAGER_V3.md Section 3.2.3 for details
    """
    logger.warning(
        f"fetch_technical_indicators() called for {ticker} but not yet implemented. "
        "This is a Phase 2 feature. Returning empty DataFrame."
    )
    
    # TODO: Phase 2 implementation
    # 1. Initialize Polygon REST client
    # 2. Call appropriate indicator API endpoint
    # 3. Parse response into DataFrame
    # 4. Add retry logic and error handling
    # 5. Write tests
    
    return pd.DataFrame()

