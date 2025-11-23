"""
FRED API Integration Module for Macroeconomic Data.

This module provides functions to fetch economic indicators from the Federal Reserve
Economic Data (FRED) API for use by the Macro Agent in portfolio analysis.

Author: Portfolio Manager V3
Date: November 21, 2025
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

import pandas as pd
import sentry_sdk
from fredapi import Fred
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings

logger = logging.getLogger(__name__)


@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=60))
def fetch_fred_series(
    series_id: str,
    observation_start: Optional[str] = None,
    observation_end: Optional[str] = None
) -> pd.Series:
    """
    Fetch economic data from FRED API.

    This function retrieves a time series of economic data from the Federal Reserve
    Economic Data (FRED) API. It includes automatic retry logic for resilience
    against transient network failures.

    Args:
        series_id: FRED series identifier (e.g., 'CPIAUCSL' for CPI, 'GDP' for GDP).
        observation_start: Start date in 'YYYY-MM-DD' format. Defaults to 1 year ago.
        observation_end: End date in 'YYYY-MM-DD' format. Defaults to today.

    Returns:
        Pandas Series with the requested economic data, indexed by date.

    Raises:
        ValueError: If FRED_API_KEY is not configured in settings.
        Exception: If FRED API request fails after all retry attempts.

    Example:
        >>> cpi_data = fetch_fred_series('CPIAUCSL', observation_start='2023-01-01')
        >>> print(cpi_data.tail())
    """
    # Validate API key presence
    api_key = getattr(settings, 'FRED_API_KEY', None)
    if not api_key:
        error_msg = "FRED_API_KEY not found in settings. Please configure it in your .env file."
        logger.error(error_msg)
        raise ValueError(error_msg)

    # Set default date range (1 year lookback if not specified)
    if observation_start is None:
        observation_start = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    if observation_end is None:
        observation_end = datetime.now().strftime('%Y-%m-%d')

    try:
        logger.info(
            f"Fetching FRED series '{series_id}' from {observation_start} to {observation_end}"
        )

        # Initialize FRED API client
        fred = Fred(api_key=api_key)

        # Fetch the series data
        data = fred.get_series(
            series_id,
            observation_start=observation_start,
            observation_end=observation_end
        )

        logger.info(f"Successfully fetched {len(data)} data points for series '{series_id}'")
        return data

    except Exception as e:
        logger.error(f"Error fetching FRED series '{series_id}': {e}")
        sentry_sdk.capture_exception(e)
        raise


def fetch_macro_indicators(lookback_days: int = 365) -> Dict[str, pd.Series]:
    """
    Fetch all macro indicators needed for Macro Agent analysis.

    This convenience function fetches the core set of macroeconomic indicators
    used for market regime classification. It handles partial failures gracefully,
    returning available data even if some series fail to fetch.

    Fetches the following indicators:
    - CPI (Consumer Price Index) - Inflation measure
    - GDP (Gross Domestic Product) - Economic growth
    - Yield Curve (10Y-2Y spread) - Recession indicator
    - Unemployment Rate - Labor market health
    - VIX - Market volatility/fear gauge

    Args:
        lookback_days: Number of days of historical data to fetch. Default is 365 (1 year).

    Returns:
        Dictionary mapping indicator name to pandas Series:
        {
            "cpi": Series(...),
            "gdp": Series(...),
            "yield_curve": Series(...),
            "unemployment": Series(...),
            "vix": Series(...)
        }

        If a series fails to fetch, it will be excluded from the result and a
        warning will be logged.

    Example:
        >>> indicators = fetch_macro_indicators(lookback_days=365)
        >>> if "cpi" in indicators:
        ...     latest_cpi = indicators["cpi"].iloc[-1]
        ...     print(f"Latest CPI: {latest_cpi}")
    """
    observation_start = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')

    # FRED series IDs for each indicator
    series_mapping = {
        "cpi": "CPIAUCSL",           # Consumer Price Index for All Urban Consumers
        "gdp": "GDP",                # Gross Domestic Product
        "yield_curve": "T10Y2Y",     # 10-Year Treasury Minus 2-Year Treasury
        "unemployment": "UNRATE",    # Unemployment Rate
        "vix": "VIXCLS"             # CBOE Volatility Index (VIX)
    }

    results = {}
    failed_series = []

    logger.info(f"Fetching {len(series_mapping)} macro indicators with {lookback_days} days lookback")

    for indicator_name, series_id in series_mapping.items():
        try:
            data = fetch_fred_series(
                series_id=series_id,
                observation_start=observation_start
            )
            results[indicator_name] = data
            logger.info(f"Successfully fetched '{indicator_name}' ({series_id})")

        except Exception as e:
            logger.warning(
                f"Failed to fetch '{indicator_name}' ({series_id}): {e}. "
                "Continuing with remaining indicators."
            )
            failed_series.append(indicator_name)
            sentry_sdk.capture_exception(e)

    if failed_series:
        logger.warning(
            f"Failed to fetch {len(failed_series)} indicators: {', '.join(failed_series)}. "
            f"Returning partial data with {len(results)} indicators."
        )

    if not results:
        logger.error("Failed to fetch any macro indicators. All series requests failed.")

    return results


def get_risk_free_rate() -> float:
    """
    Get current 10-Year Treasury yield (risk-free rate proxy).

    This function fetches the most recent 10-Year Treasury Constant Maturity Rate
    from FRED, which is used as a proxy for the risk-free rate in portfolio
    risk calculations (e.g., Sharpe Ratio).

    Returns:
        Current 10Y Treasury yield as a decimal (e.g., 0.045 for 4.5%).

    Raises:
        ValueError: If FRED_API_KEY is not configured.
        Exception: If unable to fetch the rate after retries.

    Example:
        >>> rfr = get_risk_free_rate()
        >>> print(f"Risk-free rate: {rfr:.2%}")
        Risk-free rate: 4.50%
    """
    try:
        logger.info("Fetching current risk-free rate (10Y Treasury yield)")

        # Fetch 10-Year Treasury Constant Maturity Rate
        # Using last 30 days to ensure we get the most recent value
        observation_start = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        treasury_data = fetch_fred_series(
            series_id="DGS10",
            observation_start=observation_start
        )

        # Get the most recent non-null value
        treasury_data_clean = treasury_data.dropna()
        
        if len(treasury_data_clean) == 0:
            logger.warning("No valid treasury data available, using default 4.0%")
            return 0.04
        
        latest_rate = treasury_data_clean.iloc[-1]

        # Convert from percentage to decimal (FRED returns percentages)
        rate_decimal = latest_rate / 100.0

        logger.info(f"Current risk-free rate: {rate_decimal:.4f} ({latest_rate:.2f}%)")
        return float(rate_decimal)

    except Exception as e:
        logger.error(f"Error fetching risk-free rate: {e}")
        sentry_sdk.capture_exception(e)
        raise


def get_latest_cpi_yoy() -> Optional[float]:
    """
    Get the latest year-over-year CPI (Consumer Price Index) change.
    
    Returns:
        CPI year-over-year percentage change (e.g., 3.5 for 3.5% inflation)
        or None if unavailable
    """
    try:
        # Fetch CPI data for last 2 years
        observation_start = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')
        cpi_data = fetch_fred_series("CPIAUCSL", observation_start=observation_start)
        
        if cpi_data.empty or len(cpi_data) < 12:
            logger.warning("Insufficient CPI data for YoY calculation")
            return None
        
        # Calculate year-over-year change
        latest = cpi_data.iloc[-1]
        year_ago = cpi_data.iloc[-13] if len(cpi_data) >= 13 else cpi_data.iloc[0]
        
        if year_ago == 0:
            return None
            
        yoy_change = ((latest - year_ago) / year_ago) * 100
        
        logger.info(f"Latest CPI YoY: {yoy_change:.2f}%")
        return float(yoy_change)
        
    except Exception as e:
        logger.warning(f"Error fetching CPI YoY: {e}")
        sentry_sdk.capture_exception(e)
        return None


def get_latest_gdp_growth() -> Optional[float]:
    """
    Get the latest quarter-over-quarter GDP growth rate.
    
    Returns:
        GDP quarterly growth rate as percentage (e.g., 2.5 for 2.5% growth)
        or None if unavailable
    """
    try:
        # Fetch GDP data for last 2 years
        observation_start = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')
        gdp_data = fetch_fred_series("GDP", observation_start=observation_start)
        
        if gdp_data.empty or len(gdp_data) < 2:
            logger.warning("Insufficient GDP data for growth calculation")
            return None
        
        # Calculate quarter-over-quarter growth
        latest = gdp_data.iloc[-1]
        previous = gdp_data.iloc[-2]
        
        if previous == 0:
            return None
            
        qoq_growth = ((latest - previous) / previous) * 100
        
        logger.info(f"Latest GDP QoQ Growth: {qoq_growth:.2f}%")
        return float(qoq_growth)
        
    except Exception as e:
        logger.warning(f"Error fetching GDP growth: {e}")
        sentry_sdk.capture_exception(e)
        return None


def get_yield_curve_spread() -> Optional[float]:
    """
    Get the current 10Y-2Y Treasury yield curve spread.
    
    A negative spread (inverted yield curve) is often a recession indicator.
    
    Returns:
        Yield spread in basis points (e.g., 50.0 for 50 bps positive spread)
        or None if unavailable
    """
    try:
        # Fetch yield curve spread for last 30 days
        observation_start = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        spread_data = fetch_fred_series("T10Y2Y", observation_start=observation_start)
        
        if spread_data.empty:
            logger.warning("Yield curve spread data unavailable")
            return None
        
        # Get most recent value (already in percentage points)
        latest_spread = spread_data.dropna().iloc[-1]
        
        # Convert to basis points (1% = 100 bps)
        spread_bps = latest_spread * 100
        
        logger.info(f"Latest yield curve spread: {spread_bps:.2f} bps")
        return float(spread_bps)
        
    except Exception as e:
        logger.warning(f"Error fetching yield curve spread: {e}")
        sentry_sdk.capture_exception(e)
        return None


def get_vix() -> Optional[float]:
    """
    Get the current VIX (Volatility Index) level.
    
    VIX > 20 indicates elevated market fear/volatility.
    
    Returns:
        Current VIX level (e.g., 18.5) or None if unavailable
    """
    try:
        # Fetch VIX for last 30 days
        observation_start = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        vix_data = fetch_fred_series("VIXCLS", observation_start=observation_start)
        
        if vix_data.empty:
            logger.warning("VIX data unavailable")
            return None
        
        # Get most recent value
        latest_vix = vix_data.dropna().iloc[-1]
        
        logger.info(f"Latest VIX: {latest_vix:.2f}")
        return float(latest_vix)
        
    except Exception as e:
        logger.warning(f"Error fetching VIX: {e}")
        sentry_sdk.capture_exception(e)
        return None


def get_unemployment_rate() -> Optional[float]:
    """
    Get the current unemployment rate.
    
    Returns:
        Current unemployment rate as percentage (e.g., 4.2 for 4.2%)
        or None if unavailable
    """
    try:
        # Fetch unemployment rate for last 30 days
        observation_start = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        unemployment_data = fetch_fred_series("UNRATE", observation_start=observation_start)
        
        if unemployment_data.empty:
            logger.warning("Unemployment rate data unavailable")
            return None
        
        # Get most recent value
        latest_unemployment = unemployment_data.dropna().iloc[-1]
        
        logger.info(f"Latest unemployment rate: {latest_unemployment:.2f}%")
        return float(latest_unemployment)
        
    except Exception as e:
        logger.warning(f"Error fetching unemployment rate: {e}")
        sentry_sdk.capture_exception(e)
        return None


