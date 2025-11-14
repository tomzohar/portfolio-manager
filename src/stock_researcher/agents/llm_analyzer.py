#!/usr/bin/env python3
"""
Analyze stock news using Google Gemini LLM
"""

import os
from google import genai
from typing import Dict, List, Any
from ..config import GEMINI_API_KEY

# Initialize the Gemini client
try:
    client = genai.Client(api_key=GEMINI_API_KEY)
    LLM_MODEL = 'gemini-2.5-flash'
except Exception as e:
    print(f"Error initializing Gemini client: {e}")
    raise

SYSTEM_INSTRUCTION = (
    "You are a highly professional Financial Analyst AI. Your task is to analyze a set of "
    "news articles related to a single stock ticker. Your output MUST be formatted as a "
    "concise executive summary, suitable for an investor or portfolio manager. "
    "Do not include any pre-amble or self-reference. Strictly follow the OUTPUT INSTRUCTIONS."
)


def generate_executive_summaries(all_news_data: Dict[str, List[Dict]]) -> Dict[str, str]:
    """
    Takes the retrieved news data and uses the Gemini LLM to generate an executive summary for each stock.
    
    Args:
        all_news_data: Dictionary mapping ticker symbols to lists of news articles
        
    Returns:
        Dictionary mapping ticker symbols to executive summaries
    """
    final_summaries = {}
    
    print(f"\n[Step 3] Generating Executive Summaries using LLM ({LLM_MODEL})...")
    
    for ticker, news_items in all_news_data.items():
        print(f"--> Summarizing news for {ticker}...")
        
        if not news_items:
            final_summaries[ticker] = "No recent news found for this ticker to summarize."
            continue
        
        # 1. Format the news snippets
        formatted_snippets = []
        for i, item in enumerate(news_items, 1):
            formatted_snippets.append(
                f"{i}. {item.get('title', 'N/A')}\n   Source: {item.get('source', 'N/A')}\n   Preview: {item.get('snippet', 'N/A')}\n"
            )
        
        # 2. Create the User Prompt
        user_prompt = f"""
Analyze the following news snippets for the stock ticker: **{ticker}**.

{ticker} News Snippets:
---
{''.join(formatted_snippets)}
---

OUTPUT INSTRUCTIONS:
1.  **Summary Paragraph (Max 3 Sentences):** Synthesize all snippets into a single, comprehensive paragraph summarizing the key developments (e.g., earnings, analyst changes, product news).
2.  **Key Sentiment:** Classify the overall sentiment based on the news as one of: **POSITIVE**, **NEGATIVE**, or **NEUTRAL/MIXED**. Provide a *brief* justification (Max 1 sentence).
3.  **Actionable Takeaway:** Based *only* on the provided news, state the most critical piece of information an investor should be aware of (e.g., "Earnings beat expectations, but future guidance was weak." or "Stock is reacting to a major product announcement.").
"""
        
        # 3. Call the Gemini API
        try:
            response = client.models.generate_content(
                model=LLM_MODEL,
                contents=SYSTEM_INSTRUCTION + "\n\n" + user_prompt
            )
            summary = response.text
            final_summaries[ticker] = summary.strip()
            
        except Exception as e:
            print(f"Error during Gemini API call for {ticker}: {e}")
            final_summaries[ticker] = "Summary failed due to LLM processing error."
    
    return final_summaries

