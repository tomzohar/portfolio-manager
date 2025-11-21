"""
Polygon.io Integration
Handles fetching of OHLCV data from Polygon's API.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, TypedDict

import pandas as pd
import sentry_sdk
from polygon import RESTClient
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings

# Configure logging
logger = logging.getLogger(__name__)


class OHLCVResult(TypedDict):
    """
    Typed dictionary for OHLCV fetch results.
    """
    success: bool
    data: Dict[str, pd.DataFrame]
    error: str | None


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60),
)
def _fetch_single_ticker_data(
    client: RESTClient, ticker: str, from_date: datetime.date, to_date: datetime.date
) -> pd.DataFrame:
    """
    Fetches OHLCV data for a single ticker with retry logic.
    """
    resp = client.get_aggs(ticker, 1, "day", from_date, to_date)

    if not resp:
        logger.warning("No data found for ticker: %s", ticker)
        return pd.DataFrame()

    df = pd.DataFrame(resp)
    df["datetime"] = pd.to_datetime(df["timestamp"], unit="ms")
    df.set_index("datetime", inplace=True)
    df.rename(
        columns={
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "volume": "Volume",
        },
        inplace=True,
    )
    logger.info("Fetched %d data points for %s", len(df), ticker)
    return df[["Open", "High", "Low", "Close", "Volume"]]


def fetch_ohlcv_data(
    tickers: List[str], period: str = "1y"
) -> OHLCVResult:
    """
    Fetches historical OHLCV data for a list of stock tickers using the Polygon API.

    This function is vectorized-friendly for analysis but fetches data per-ticker
    from the API.

    Args:
        tickers: A list of stock ticker symbols.
        period: The period for which to fetch the data (e.g., "1y", "2y").

    Returns:
        A dictionary containing the fetch status, a dictionary of pandas DataFrames
        with OHLCV data, and an optional error message.
    """
    logger.info(
        "Fetching OHLCV data for %d tickers for the period: %s",
        len(tickers),
        period,
    )

    if not settings.POLYGON_API_KEY:
        logger.error("Polygon API key is not configured.")
        return {
            "success": False,
            "data": {},
            "error": "Polygon API key is not configured.",
        }

    try:
        client = RESTClient(settings.POLYGON_API_KEY)

        to_date = datetime.now().date()
        if period.endswith("y"):
            years = int(period[:-1])
            from_date = to_date - timedelta(days=years * 365)
        else:
            logger.warning("Unrecognized period format '%s'. Defaulting to 1 year.", period)
            from_date = to_date - timedelta(days=365)

        ohlcv_data: Dict[str, pd.DataFrame] = {}
        for ticker in tickers:
            try:
                ohlcv_data[ticker] = _fetch_single_ticker_data(
                    client, ticker, from_date, to_date
                )
            except Exception as e:
                logger.error(
                    "Failed to fetch data for ticker %s: %s", ticker, e, exc_info=True
                )
                sentry_sdk.capture_exception(e)
                ohlcv_data[ticker] = pd.DataFrame()  # Return empty df for the failed ticker

        return {"success": True, "data": ohlcv_data, "error": None}

    except Exception as e:
        logger.critical("A critical error occurred in fetch_ohlcv_data: %s", e, exc_info=True)
        sentry_sdk.capture_exception(e)
        return {"success": False, "data": {}, "error": str(e)}

