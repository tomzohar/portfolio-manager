#!/usr/bin/env python3
"""
Stocks Researcher Main Module
Entry point for running the complete stock research workflow
"""

import sys
from pathlib import Path

# Remove the manual path insertion
# sys.path.insert(0, str(Path(__file__).parent / "src"))

from stock_researcher.orchestrator import research_portfolio
from stock_researcher.notifications.whatsapp import send_stock_research_summary, send_whatsapp_message
from stock_researcher.pre_processor.update_prices import update_gsheet_prices
from stock_researcher.config import TWILIO_WHATSAPP_TO, validate_config


def main():
    """
    Main entry point for stock research application
    Orchestrates the workflow and handles output/notifications
    """
    print("=" * 60)
    print("STOCK RESEARCH WORKFLOW INITIATED")
    print("=" * 60)

    try:
        # Validate that all required environment variables are set
        validate_config()
        
        # Pre-process: Update stock prices in Google Sheet
        _update_prices()
        
        # Core logic: Research portfolio and generate recommendations
        tickers, news, summaries, portfolio, recommendations = research_portfolio()
        
        # Post-process: Display results and send notifications
        _display_results(portfolio, news, summaries, recommendations)
        _send_whatsapp_notification(recommendations)
        
    except Exception as e:
        print(f"❌ An unexpected error occurred during the main workflow: {e}")
        # This will send the exception to Sentry if configured
        raise e

    print("\n" + "=" * 60)
    print("RESEARCH WORKFLOW COMPLETE")
    print("=" * 60)


def _update_prices():
    """Update stock prices in Google Sheet, with error handling"""
    print("\n" + "=" * 60)
    print("PRE-PROCESSING: UPDATING STOCK PRICES IN GOOGLE SHEET")
    print("=" * 60)
    try:
        update_gsheet_prices()
        print("✅ Portfolio prices updated successfully.")
    except Exception as e:
        print(f"⚠️ Warning: Automatic price update failed: {e}")
        print("Continuing with last known prices.")


def _display_results(portfolio, news_data, summaries, recommendations):
    """Display the formatted research results and recommendations"""
    # 1. Display Portfolio Summary
    print("\n" + "=" * 80)
    print(f"PORTFOLIO SUMMARY - Total Value: ${portfolio.total_value:,.2f}")
    print("=" * 80)
    for pos in portfolio.positions:
        print(f"{pos.symbol:<8} | {pos.position:>7} shares | ${pos.price:>8.2f} | ${pos.market_value:>10,.2f} | {pos.percent_of_total:>6.2f}%")
    print("=" * 80)

    # 2. Display Executive Summaries
    print("\n" + "=" * 80)
    print("EXECUTIVE SUMMARIES - AI-Powered Stock Analysis")
    print("=" * 80)

    if not summaries:
        print("No summaries were generated.")
    else:
        for ticker in portfolio.get_symbols():
            summary_text = summaries.get(ticker, "No summary available.")
            position = portfolio.get_position(ticker)
            articles = news_data.get(ticker, [])

            print("\n" + "=" * 80)
            print(f"📊 {ticker}")
            print("=" * 80)
            if position:
                print(f"💼 Position: {position.position} shares @ ${position.price:.2f} = ${position.market_value:,.2f} ({position.percent_of_total:.2f}% of portfolio)\n")
            
            print(summary_text)

            if articles:
                print(f"\n📰 Source Articles ({len(articles)}):")
                print("-" * 80)
                for i, article in enumerate(articles, 1):
                    print(f"{i}. {article['title']}\n   Source: {article['source']} | Link: {article['link']}")
    
    # 3. Display Recommendations
    print("\n" + "=" * 80)
    print("🤖 PORTFOLIO MANAGER RECOMMENDATIONS")
    print("=" * 80)

    if recommendations:
        print(recommendations.get('overall_assessment', 'No overall assessment provided.'))
        
        for rec in recommendations.get('recommendations', []):
            print(f"\n- Recommendation for {rec['ticker']}: {rec['recommendation']}")
            print(f"  - Reasoning: {rec['reasoning']}")
    else:
        print("No recommendations were generated.")

    print("=" * 80)


def _send_whatsapp_notification(recommendations):
    """Send research summary via WhatsApp"""
    print("\n[Final Step] Sending summary via WhatsApp...")
    try:
        message_sid = send_stock_research_summary(recommendations, to_number=TWILIO_WHATSAPP_TO)
        print(f"✅ WhatsApp message sent! (SID: {message_sid})")
    except Exception as e:
        print(f"⚠️ Could not send WhatsApp message: {e}")


if __name__ == '__main__':
    main()

