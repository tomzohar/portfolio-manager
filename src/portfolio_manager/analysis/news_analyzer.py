"""
News Analyzer

Analyzes stock news articles using Google Gemini LLM to generate executive summaries
with sentiment analysis and actionable insights for investors.

This module provides concurrent news analysis capabilities, processing multiple
tickers in parallel for optimal performance.

Author: Portfolio Manager Agent
Version: 2.0.0 (Migrated from legacy stock_researcher)
"""

import logging
from typing import Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor

import sentry_sdk
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from ..utils import call_gemini_api
from ..config import settings

logger = logging.getLogger(__name__)

# System instruction for the LLM
SYSTEM_INSTRUCTION = (
    "You are a highly professional Financial Analyst AI. Your task is to analyze a set of "
    "news articles related to a single stock ticker. Your output MUST be formatted as a "
    "concise executive summary, suitable for an investor or portfolio manager. "
    "Do not include any pre-amble or self-reference. Strictly follow the OUTPUT INSTRUCTIONS."
)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _generate_summary_for_ticker(ticker: str, news_items: List[Dict]) -> Tuple[str, str]:
    """
    Generates an executive summary for a single stock ticker using LLM analysis.
    
    This function processes news articles for a ticker and generates:
    1. A comprehensive summary paragraph (max 3 sentences)
    2. Overall sentiment classification (POSITIVE/NEGATIVE/NEUTRAL)
    3. An actionable takeaway for investors
    
    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        news_items: List of news article dictionaries containing:
                   - title: Article headline
                   - source: News source
                   - snippet: Article preview/description
    
    Returns:
        Tuple of (ticker, summary_text):
        - ticker: The stock ticker symbol
        - summary_text: LLM-generated executive summary or error message
    
    Raises:
        Exception: On LLM API failures after retries
    
    Example:
        >>> news = [{"title": "Apple Q4 Earnings", "source": "CNBC", "snippet": "..."}]
        >>> ticker, summary = _generate_summary_for_ticker("AAPL", news)
        >>> print(summary)
        "Apple reported record Q4 earnings... Sentiment: POSITIVE..."
    
    Notes:
        - Returns a default message if no news items provided
        - Retries up to 3 times on API failures with exponential backoff
        - Errors are captured in Sentry for monitoring
    """
    logger.debug(f"Generating news summary for {ticker}...")
    
    if not news_items:
        logger.warning(f"No news items provided for {ticker}")
        return ticker, "No recent news found for this ticker to summarize."
    
    try:
        # Format news snippets for the LLM prompt
        formatted_snippets = [
            f"{i}. {item.get('title', 'N/A')}\n   Source: {item.get('source', 'N/A')}\n   Preview: {item.get('snippet', 'N/A')}\n"
            for i, item in enumerate(news_items, 1)
        ]
        
        # Construct the user prompt with instructions
        user_prompt = f"""
    Analyze the following news snippets for the stock ticker: **{ticker}**.

    {ticker} News Snippets:
    ---
    {''.join(formatted_snippets)}
    ---

    OUTPUT INSTRUCTIONS:
    1.  **Summary Paragraph (Max 3 Sentences):** Synthesize all snippets into a single, comprehensive paragraph summarizing the key developments (e.g., earnings, analyst changes, product news).
    2.  **Key Sentiment:** Classify the overall sentiment based on the news as one of: **POSITIVE**, **NEGATIVE**, or **NEUTRAL/MIXED**. Provide a *brief* justification (Max 1 sentence).
    3.  **Actionable Takeaway:** Based *only* on the provided news, state the most critical piece of information an investor should be aware of.
    """
        
        full_prompt = SYSTEM_INSTRUCTION + "\n\n" + user_prompt
        
        # Call the LLM API (uses Flash model for speed)
        summary = call_gemini_api(full_prompt, model=settings.ANALYSIS_MODEL)
        
        logger.info(f"Successfully generated news summary for {ticker}")
        return ticker, summary.strip()
        
    except Exception as e:
        logger.error(f"Failed to generate news summary for {ticker}: {str(e)}", exc_info=True)
        sentry_sdk.capture_exception(e)
        return ticker, "Summary failed due to LLM processing error."


def generate_executive_summaries(all_news_data: Dict[str, List[Dict]]) -> Dict[str, str]:
    """
    Generates executive summaries for multiple stock tickers concurrently.
    
    This function processes news articles for multiple tickers in parallel,
    using a ThreadPoolExecutor to maximize throughput while respecting API
    rate limits (max 2 concurrent workers).
    
    Args:
        all_news_data: Dictionary mapping ticker symbols to lists of news articles.
                      Each article dict should contain: title, source, snippet
                      
                      Example:
                      {
                          "AAPL": [
                              {"title": "...", "source": "...", "snippet": "..."},
                              ...
                          ],
                          "MSFT": [...]
                      }
    
    Returns:
        Dictionary mapping ticker symbols to LLM-generated executive summaries.
        
        Example:
        {
            "AAPL": "Apple announced record Q4 earnings beating analyst expectations...
                    Sentiment: POSITIVE. Strong fundamentals support continued growth.",
            "MSFT": "Microsoft Azure growth slowed in Q3...
                    Sentiment: NEUTRAL/MIXED. Market awaits AI product updates."
        }
    
    Notes:
        - Processes up to 2 tickers concurrently (respects API rate limits)
        - Each ticker's summary is independent
        - Failed summaries return error messages but don't block other tickers
        - Typical processing time: 3-5 seconds per ticker
        - Uses Gemini Flash model for cost efficiency
    
    Example:
        >>> news_data = {
        ...     "AAPL": [{"title": "...", "source": "...", "snippet": "..."}],
        ...     "MSFT": [{"title": "...", "source": "...", "snippet": "..."}]
        ... }
        >>> summaries = generate_executive_summaries(news_data)
        >>> for ticker, summary in summaries.items():
        ...     print(f"{ticker}: {summary[:100]}...")
    """
    if not all_news_data:
        logger.warning("No news data provided for summary generation")
        return {}
    
    logger.info(f"Generating executive summaries for {len(all_news_data)} tickers using {settings.ANALYSIS_MODEL}...")
    
    final_summaries = {}
    
    try:
        # Use ThreadPoolExecutor for concurrent LLM API calls
        # Limit to 2 workers to respect API rate limits and avoid throttling
        with ThreadPoolExecutor(max_workers=2) as executor:
            # Submit all ticker analysis tasks
            futures = [
                executor.submit(_generate_summary_for_ticker, ticker, news_items) 
                for ticker, news_items in all_news_data.items()
            ]
            
            # Collect results as they complete
            for future in futures:
                try:
                    ticker, summary = future.result()
                    final_summaries[ticker] = summary
                except Exception as e:
                    logger.error(f"Failed to process a ticker summary: {str(e)}", exc_info=True)
                    sentry_sdk.capture_exception(e)
                    # Continue processing other tickers
        
        logger.info(f"Successfully generated {len(final_summaries)} executive summaries")
        return final_summaries
        
    except Exception as e:
        logger.error(f"Fatal error during summary generation: {str(e)}", exc_info=True)
        sentry_sdk.capture_exception(e)
        # Return whatever we managed to generate
        return final_summaries
