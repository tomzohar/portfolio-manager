#!/usr/bin/env python3
"""
Stock Research Orchestrator
Central workflow for researching stock portfolio news
"""

from typing import Dict, List, Tuple
from .agents.portfolio_parser import parse_portfolio, Portfolio
from .agents.news_searcher import get_stock_news
from .agents.llm_analyzer import generate_executive_summaries
from .agents.portfolio_manager import generate_portfolio_recommendations
from .agents.technical_analyzer import analyze_stock_technicals
from .config import (
    GOOGLE_SERVICE_ACCOUNT_FILE,
    SPREADSHEET_ID,
    SERPAPI_API_KEY
)


def research_portfolio() -> Tuple[List[str], Dict[str, List[Dict]], Dict[str, str], Portfolio, Dict]:
    """
    Complete stock research workflow:
    1. Parse portfolio from Google Sheets
    2. Perform web search for news articles
    3. Generate AI summaries from LLM
    4. Generate portfolio recommendations
    
    Returns:
        Tuple containing:
        - List of stock tickers from portfolio
        - Dict of news articles by ticker
        - Dict of executive summaries by ticker
        - Portfolio object with full position data
        - Dict of portfolio recommendations
    """
    print("=" * 60)
    print("STOCK RESEARCH WORKFLOW INITIATED")
    print("=" * 60)
    
    # Agent 1: Parse portfolio from Google Sheets
    print("\n[Agent 1] Parsing portfolio from Google Sheets...")
    portfolio = parse_portfolio(GOOGLE_SERVICE_ACCOUNT_FILE, SPREADSHEET_ID)
    stock_tickers = portfolio.get_symbols()
    print(f"✅ Loaded portfolio with {len(stock_tickers)} positions")
    print(f"   Total Portfolio Value: ${portfolio.total_value:,.2f}")
    
    # Agent 2: Web search for news articles
    print(f"\n[Agent 2] Searching for news articles ({len(stock_tickers)} stocks)...")
    news_data = get_stock_news(stock_tickers, SERPAPI_API_KEY)
    print(f"✅ Retrieved news for {len(news_data)} stocks")
    
    # Agent 3: Generate LLM summaries
    print(f"\n[Agent 3] Generating AI-powered executive summaries...")
    executive_summaries = generate_executive_summaries(news_data)
    print(f"✅ Generated {len(executive_summaries)} summaries")
    
    # Agent 4: Generate Technical Analysis
    print(f"\n[Agent 4] Performing technical analysis...")
    technical_analysis = analyze_stock_technicals(stock_tickers)
    print(f"✅ Generated technical analysis for {len(technical_analysis)} stocks.")
    
    # Agent 5: Generate portfolio recommendations
    print(f"\n[Agent 5] Generating portfolio management recommendations...")
    recommendations = generate_portfolio_recommendations(portfolio, executive_summaries, technical_analysis)
    print(f"✅ Generated portfolio recommendations.")
    
    print("\n" + "=" * 60)
    print("RESEARCH WORKFLOW COMPLETE")
    print("=" * 60)
    
    return stock_tickers, news_data, executive_summaries, portfolio, recommendations


def get_research_summary(tickers: List[str], summaries: Dict[str, str]) -> str:
    """
    Format research results into a readable summary
    
    Args:
        tickers: List of stock tickers
        summaries: Dict of executive summaries by ticker
        
    Returns:
        Formatted string summary
    """
    output = []
    output.append("=" * 80)
    output.append("EXECUTIVE SUMMARIES - AI-Powered Stock Analysis")
    output.append("=" * 80)
    
    for ticker in tickers:
        summary = summaries.get(ticker, "No summary available.")
        output.append(f"\n{'='*80}")
        output.append(f"📊 {ticker}")
        output.append('='*80)
        output.append(summary)
    
    return "\n".join(output)

