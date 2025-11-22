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
        latest_rate = treasury_data.dropna().iloc[-1]

        # Convert from percentage to decimal (FRED returns percentages)
        rate_decimal = latest_rate / 100.0

        logger.info(f"Current risk-free rate: {rate_decimal:.4f} ({latest_rate:.2f}%)")
        return float(rate_decimal)

    except Exception as e:
        logger.error(f"Error fetching risk-free rate: {e}")
        sentry_sdk.capture_exception(e)
        raise

