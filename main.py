#!/usr/bin/env python3
"""
Stocks Researcher Main Module
Entry point for running the complete stock research workflow
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from stock_researcher.orchestrator import research_portfolio_news
from stock_researcher.notifications.whatsapp import send_stock_research_summary, send_whatsapp_message
from stock_researcher.pre_processor.update_prices import update_gsheet_prices


def main():
    """
    Main entry point for stock research application
    Orchestrates the workflow and handles output/notifications
    """
    # Attempt to update prices, but don't block the main workflow if it fails
    try:
        print("Attempting to update portfolio prices in Google Sheet...")
        update_gsheet_prices()
        print("✅ Portfolio prices updated successfully.")
    except Exception as e:
        warning_message = f"⚠️ Warning: Automatic price update failed: {e}\nContinuing with last known prices."
        print(warning_message)
        try:
            send_whatsapp_message(f"📈 Stock Researcher Alert:\n{warning_message}")
        except Exception as e_whatsapp:
            print(f"⚠️ Failed to send price update failure notification: {e_whatsapp}")

    try:
        # Run the complete research workflow with portfolio data
        stock_tickers, news_data, executive_summaries, portfolio, recommendations = research_portfolio_news()
    
        # Display portfolio summary if available
        if portfolio:
            print(portfolio)
        
        # Display results
        _display_results(stock_tickers, news_data, executive_summaries, portfolio)
        
        # Display recommendations
        _display_recommendations(recommendations)
        
        # Send WhatsApp notification
        _send_whatsapp_notification(recommendations)
        
    except Exception as e:
        print(f"\n❌ Error in main workflow: {e}")
        raise


def _display_results(tickers, news_data, summaries, portfolio=None):
    """Display formatted research results to console"""
    print("\n" + "=" * 80)
    print("EXECUTIVE SUMMARIES - AI-Powered Stock Analysis")
    print("=" * 80)
    
    for ticker in tickers:
        print(f"\n{'='*80}")
        print(f"📊 {ticker}")
        print('='*80)
        
        # Display portfolio position if available
        if portfolio:
            position = portfolio.get_position(ticker)
            if position:
                print(f"💼 Position: {position.position} shares @ ${position.price:.2f} = ${position.market_value:,.2f} ({position.percent_of_total:.2f}% of portfolio)\n")
        
        # Display AI Summary
        summary = summaries.get(ticker, "No summary available.")
        print(summary)
        
        # Display raw news articles
        news_articles = news_data.get(ticker, [])
        if news_articles:
            print(f"\n📰 Source Articles ({len(news_articles)}):")
            print("-" * 80)
            for i, article in enumerate(news_articles, 1):
                print(f"{i}. {article['title']}")
                print(f"   Source: {article.get('source', 'N/A')} | Link: {article.get('link', 'N/A')}")
        else:
            print("\n📰 Source Articles: None found")
    
    print("\n" + "=" * 80)
    print("✅ Research Complete!")
    print("=" * 80)


def _display_recommendations(recommendations):
    """Display portfolio recommendations"""
    print("\n" + "=" * 80)
    print("🤖 PORTFOLIO MANAGER RECOMMENDATIONS")
    print("=" * 80)
    
    summary = recommendations.get('portfolio_summary', 'No summary provided.')
    print(f"Overall Assessment: {summary}")
    
    recs = recommendations.get('recommendations', [])
    if not recs:
        print("\nNo specific actions recommended at this time.")
    else:
        for rec in recs:
            print(f"\n- Recommendation for {rec.get('ticker')}: {rec.get('recommendation')}")
            print(f"  - Reasoning: {rec.get('reasoning', 'N/A')}")
            print(f"  - Suggested Action: {rec.get('suggested_action', 'N/A')}")
    
    print("\n" + "=" * 80)


def _send_whatsapp_notification(recommendations):
    """Send research summary via WhatsApp"""
    print("\n[Final Step] Sending summary via WhatsApp...")
    try:
        message_sid = send_stock_research_summary(recommendations)
        print(f"✅ WhatsApp message sent! (SID: {message_sid})")
    except Exception as e:
        print(f"⚠️ Could not send WhatsApp message: {e}")


if __name__ == "__main__":
    main()

