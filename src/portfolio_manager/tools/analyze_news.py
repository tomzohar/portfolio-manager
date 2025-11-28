"""
Analyze News Tool

This tool fetches and analyzes recent news articles for specified stock tickers.
It combines news search (via SerpAPI) and LLM-based sentiment analysis into a
single, streamlined operation.

The tool is essential for understanding fundamental factors affecting stocks
and provides qualitative insights that complement technical analysis.

Author: Portfolio Manager Agent
Version: 1.0.0
"""

from typing import List, Dict, Any
import logging

from stock_researcher.agents.news_searcher import get_stock_news
from stock_researcher.agents.llm_analyzer import generate_executive_summaries
from ..agent_state import ToolResult
from ..integrations.serp_api import get_stock_news
from ..tool_registry import tool
from ..utils import ApiType
from ..config import settings  # NEW: Import centralized settings

logger = logging.getLogger(__name__)


@tool(
    name="analyze_news",
    description="Fetches and analyzes recent news for specific stock tickers. Returns sentiment and summary for each ticker.",
    parameters={
        "tickers": {
            "type": "List[str]",
            "description": "List of stock ticker symbols to analyze (e.g., ['AAPL', 'MSFT'])",
            "required": True
        }
    },
    examples=[
        '{"tool": "analyze_news", "args": {"tickers": ["AAPL"]}}',
        '{"tool": "analyze_news", "args": {"tickers": ["AAPL", "MSFT", "GOOGL"]}}'
    ]
)
def analyze_news_tool(tickers: List[str]) -> ToolResult:
    """
    Analyze News Tool
    
    Fetches recent news articles for specified tickers and generates
    AI-powered executive summaries with sentiment analysis.
    
    **Data Flow:**
    1. Searches for recent news articles (SerpAPI)
       - Top 3 articles per ticker
       - Focuses on financial news and analysis
       - Includes title, snippet, source, and link
    
    2. Generates LLM summaries (Gemini Flash)
       - Concurrent processing (2 workers) for speed
       - Executive summary (max 3 sentences)
       - Sentiment classification (POSITIVE/NEGATIVE/NEUTRAL)
       - Actionable takeaway for investors
    
    **Args:**
        tickers: List of stock ticker symbols (e.g., ["AAPL", "MSFT"])
                 Max recommended: 20 tickers per call for performance
    
    **Returns:**
        ToolResult with:
        - success: True if analysis completed for all tickers
        - data: Dict[str, str] mapping ticker to AI-generated summary
            Example: {
                "AAPL": "Apple announced record Q4 earnings...
                        Sentiment: POSITIVE.
                        Key takeaway: Strong fundamentals support growth."
            }
        - error: None on success, error message on failure
        - confidence_impact: 0.0-0.3 based on article count (more articles = higher)
    
    **Example:**
        >>> result = analyze_news_tool(tickers=["AAPL", "TSLA"])
        >>> if result.success:
        ...     for ticker, summary in result.data.items():
        ...         print(f"{ticker}: {summary[:100]}...")
    
    **Error Handling:**
        - SerpAPI failures (rate limits, network issues)
        - LLM API failures (timeout, quota exceeded)
        - Missing API keys
        - Invalid ticker symbols (returns empty results)
        
        Errors are logged and returned; the tool fails gracefully.
    
    **Performance:**
        - Typical execution: 5-10 seconds for 3 tickers
        - Concurrent LLM calls (max 2 workers)
        - Network-dependent (SerpAPI + Gemini API)
    
    **Cost:**
        - SerpAPI: ~$0.01 per search
        - Gemini Flash: ~$0.001 per summary
        - Total: ~$0.03-$0.05 per ticker
    
    **Side Effects:**
        - API calls to SerpAPI and Google Gemini
        - Logs info/error messages
        - No state modifications
    
    **Notes:**
        - Summaries are truncated to 400 chars for prompt efficiency
        - News is typically from the last 24-48 hours
        - Sentiment is AI-generated and may not be perfect
    """
    try:
        logger.info(f"Tool invoked: analyze_news for tickers: {tickers}")
        
        if not tickers:
            logger.warning("No tickers provided for news analysis")
            return ToolResult(
                success=True,
                data={},
                error=None,
                confidence_impact=0.0,
            )
        
        # Step 1: Search for news articles using the legacy function
        # Pass the API key from our centralized settings
        news_dict = get_stock_news(tickers, settings.SERPAPI_API_KEY)
        
        # Step 2: Summarize with LLM using the legacy function
        summaries = generate_executive_summaries(news_dict)
        
        logger.info(f"News analysis completed for {len(summaries)} tickers")
        
        # Calculate confidence impact based on data quality
        total_articles = sum(len(articles) for articles in news_dict.values())
        confidence_impact = min(0.3, total_articles / 100)  # More articles = higher confidence, capped at 0.3
        
        # Report API calls for cost tracking
        api_calls = [
            {"api_type": ApiType.SERP_API.value, "count": len(tickers)},
            {"api_type": ApiType.LLM_GEMINI_2_5_FLASH.value, "count": len(summaries)},
        ]
        
        # NEW: Construct the state_patch
        state_patch = {
            "analysis_results": {
                ticker: {"news": summary} for ticker, summary in summaries.items()
            }
        }
        
        return ToolResult(
            success=True,
            data=summaries,
            error=None,
            confidence_impact=confidence_impact,
            state_patch=state_patch,
            api_calls=api_calls,
        )
    
    except Exception as e:
        logger.error(f"Failed to analyze news for {tickers}: {str(e)}", exc_info=True)
        return ToolResult(
            success=False,
            data={},
            error=f"News analysis failed: {str(e)}",
            confidence_impact=-0.1,  # Partial failure - can continue without news
        )

