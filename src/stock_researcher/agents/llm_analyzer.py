#!/usr/bin/env python3
"""
Analyze stock news using Google Gemini LLM
"""

import os
from typing import Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor
from ..utils.llm_utils import call_gemini_api, LLM_MODEL

SYSTEM_INSTRUCTION = (
    "You are a highly professional Financial Analyst AI. Your task is to analyze a set of "
    "news articles related to a single stock ticker. Your output MUST be formatted as a "
    "concise executive summary, suitable for an investor or portfolio manager. "
    "Do not include any pre-amble or self-reference. Strictly follow the OUTPUT INSTRUCTIONS."
)

def _generate_summary_for_ticker(ticker: str, news_items: List[Dict]) -> Tuple[str, str]:
    """Generates an executive summary for a single stock ticker."""
    print(f"--> Summarizing news for {ticker}...")
    
    if not news_items:
        return ticker, "No recent news found for this ticker to summarize."
    
    # Format news snippets and create the prompt
    formatted_snippets = [
        f"{i}. {item.get('title', 'N/A')}\n   Source: {item.get('source', 'N/A')}\n   Preview: {item.get('snippet', 'N/A')}\n"
        for i, item in enumerate(news_items, 1)
    ]
    
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
    
    try:
        summary = call_gemini_api(full_prompt)
        return ticker, summary.strip()
    except Exception as e:
        print(f"Error during Gemini API call for {ticker}: {e}")
        return ticker, "Summary failed due to LLM processing error."

def generate_executive_summaries(all_news_data: Dict[str, List[Dict]]) -> Dict[str, str]:
    """
    Takes the retrieved news data and uses the Gemini LLM to generate an executive summary for each stock concurrently.
    
    Args:
        all_news_data: Dictionary mapping ticker symbols to lists of news articles.
        
    Returns:
        Dictionary mapping ticker symbols to executive summaries.
    """
    print(f"\n[Agent 3] Generating Executive Summaries using LLM ({LLM_MODEL})...")
    
    final_summaries = {}
    # Use a ThreadPoolExecutor to make concurrent API calls, limiting concurrency to 2
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Create a list of futures
        futures = [executor.submit(_generate_summary_for_ticker, ticker, news_items) 
                   for ticker, news_items in all_news_data.items()]
        
        # As each future completes, get the result and add it to the final dictionary
        for future in futures:
            ticker, summary = future.result()
            final_summaries[ticker] = summary
            
    return final_summaries

