"""
News Search Integration using SerpAPI

This module provides functionality to fetch recent news articles for stock tickers
using the SerpAPI Google News search engine. It includes retry logic, error handling,
and structured data models for news articles.

Author: Portfolio Manager Agent
Version: 2.0.0 (Migrated from stock_researcher.agents.news_searcher)
"""

import logging
from typing import Dict, List

import sentry_sdk
from pydantic import BaseModel, Field
from serpapi import GoogleSearch
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings

logger = logging.getLogger(__name__)


class NewsArticle(BaseModel):
    """
    Structured representation of a news article from SerpAPI.
    
    Attributes:
        title: Article headline
        snippet: Brief excerpt or summary
        source: Publisher name (e.g., "CNBC", "Bloomberg")
        link: URL to the full article
    """
    title: str
    snippet: str
    source: str
    link: str


class NewsSearchResult(BaseModel):
    """
    Collection of news articles for a single ticker.
    
    Attributes:
        ticker: Stock ticker symbol
        articles: List of retrieved news articles
        success: Whether the search succeeded
        error: Error message if search failed
    """
    ticker: str
    articles: List[NewsArticle] = Field(default_factory=list)
    success: bool = True
    error: str | None = None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def _search_news_for_ticker(ticker: str, api_key: str) -> NewsSearchResult:
    """
    Internal function to search news for a single ticker with retry logic.
    
    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        api_key: SerpAPI API key for authentication
    
    Returns:
        NewsSearchResult containing articles or error information
        
    Raises:
        Exception: If all retry attempts fail
    """
    logger.debug(f"Searching for news on: {ticker}")
    
    # Craft a precise search query targeting financial news
    query = f'"{ticker}" stock news today financial analysis'
    
    # Parameters for a focused news search
    params = {
        "engine": "google",    # Use Google Search engine
        "q": query,            # The specific query
        "tbm": "nws",          # Target only the "News" tab
        "gl": "us",            # Geolocation for results
        "num": 3,              # Retrieve the top 3 results
        "api_key": api_key     # API key for authentication
    }
    
    # Execute the search
    search = GoogleSearch(params)
    results = search.get_dict()
    
    # Extract and structure the news articles
    articles = []
    if 'news_results' in results:
        for item in results['news_results']:
            try:
                article = NewsArticle(
                    title=item.get('title', ''),
                    snippet=item.get('snippet', ''),
                    source=item.get('source', ''),
                    link=item.get('link', '')
                )
                articles.append(article)
            except Exception as e:
                logger.warning(f"Failed to parse news item for {ticker}: {e}")
                continue
    
    return NewsSearchResult(
        ticker=ticker,
        articles=articles,
        success=True,
        error=None
    )


def get_stock_news(tickers: List[str]) -> Dict[str, List[Dict]]:
    """
    Searches for the latest news for a list of stock tickers using SerpAPI.
    
    This function fetches the top 3 recent news articles for each ticker from
    Google News via SerpAPI. It includes error handling, retry logic, and
    structured logging.
    
    **Data Flow:**
    1. Validates input tickers list
    2. For each ticker:
       - Constructs targeted news search query
       - Calls SerpAPI Google News search (with retry)
       - Parses and structures results
       - Handles errors gracefully
    3. Returns dictionary mapping tickers to article lists
    
    **Args:**
        tickers: List of stock ticker symbols (e.g., ["AAPL", "MSFT", "GOOGL"])
                 Recommended max: 20 tickers per call for performance
    
    **Returns:**
        Dictionary mapping ticker symbols to lists of news articles.
        Each article is a dict with keys: 'title', 'snippet', 'source', 'link'
        
        Example:
        {
            "AAPL": [
                {
                    "title": "Apple Q4 Earnings Beat Expectations",
                    "snippet": "Apple posted strong revenue growth...",
                    "source": "CNBC",
                    "link": "https://example.com/article1"
                },
                ...
            ],
            "MSFT": [...]
        }
    
    **Error Handling:**
        - Invalid tickers: Returns empty list for that ticker
        - API errors: Retries up to 3 times with exponential backoff
        - Network failures: Captures exception, returns empty list
        - All errors are logged and reported to Sentry
    
    **Performance:**
        - Sequential processing (one ticker at a time)
        - Typical: 1-2 seconds per ticker
        - Total time: ~(num_tickers * 1.5) seconds
    
    **Cost:**
        - SerpAPI: ~$0.01 per search
        - Total: ~$0.01 * len(tickers)
    
    **Side Effects:**
        - Makes network calls to SerpAPI
        - Logs info/warning/error messages
        - Reports errors to Sentry
    
    **Example:**
        >>> news_data = get_stock_news(["AAPL", "MSFT"])
        >>> print(f"Found {len(news_data['AAPL'])} articles for AAPL")
        Found 3 articles for AAPL
    
    **Notes:**
        - API key is automatically loaded from settings.SERPAPI_API_KEY
        - News articles are typically from the last 24-48 hours
        - Results may vary based on news availability and search quality
    """
    if not tickers:
        logger.warning("No tickers provided for news search")
        return {}
    
    logger.info(f"Starting news retrieval for {len(tickers)} tickers...")
    
    all_news_data = {}
    api_key = settings.SERPAPI_API_KEY
    
    for ticker in tickers:
        try:
            # Search with retry logic
            result = _search_news_for_ticker(ticker, api_key)
            
            # Convert Pydantic models to dict format for compatibility
            all_news_data[ticker] = [
                article.model_dump() for article in result.articles
            ]
            
            logger.debug(f"Found {len(result.articles)} articles for {ticker}")
            
        except Exception as e:
            # Log and report error, but continue with other tickers
            error_msg = f"Error searching news for {ticker}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            sentry_sdk.capture_exception(e)
            
            # Return empty list for failed ticker
            all_news_data[ticker] = []
    
    logger.info(f"News retrieval complete. Fetched articles for {len(all_news_data)} tickers")
    
    return all_news_data
