#!/usr/bin/env python3
"""
Portfolio Manager Agent
Analyzes portfolio and news summaries to generate actionable trading recommendations
"""

import json
from typing import Dict, Any
from .portfolio_parser import Portfolio
from ..utils.llm_utils import call_gemini_api, LLM_MODEL

SYSTEM_INSTRUCTION = (
    "You are an expert financial analyst and portfolio manager. Your task is to provide actionable "
    "recommendations ONLY for stocks that require action. Analyze the client's portfolio, news, and "
    "technicals to form a holistic view.\n\n"
    "Your Instructions:\n"
    "1. Provide a high-level summary of your overall assessment of the portfolio.\n"
    "2. Identify ONLY stocks that require an action (INCREASE or DECREASE). If no stocks require action, "
    "the 'recommendations' list should be empty.\n"
    "3. For each stock requiring action, provide a clear 'recommendation' ('INCREASE' or 'DECREASE') and a "
    "concise 'reasoning' that considers both fundamental (news) and technical factors.\n\n"
    "Your final output MUST be a JSON object with two keys: 'portfolio_summary' and 'recommendations'. The "
    "'recommendations' key must be a list of objects, each with 'ticker', 'recommendation', and 'reasoning' keys.\n\n"
    "Example for the 'recommendations' list:\n"
    "[\n"
    "    {\n"
    "        \"ticker\": \"TSLA\",\n"
    "        \"recommendation\": \"DECREASE\",\n"
    "        \"reasoning\": \"Negative news about production delays combined with the stock breaking below its 50-day moving average.\"\n"
    "    }\n"
    "]\n\n"
    "**IMPORTANT CONSTRAINTS:**\n"
    "- The total JSON output must be under 1500 characters.\n"
    "- The `portfolio_summary` must be a concise, high-level overview, MAXIMUM 400 characters.\n"
    "- The `reasoning` for each recommendation must be a single, brief sentence, MAXIMUM 150 characters."
)


def generate_portfolio_recommendations(
    portfolio: Portfolio, 
    summaries: Dict[str, str], 
    technical_analysis: Dict[str, str]
) -> Dict[str, Any]:
    """
    Generates trading recommendations based on portfolio, news, and technical analysis.

    Args:
        portfolio: The user's current portfolio object.
        summaries: A dictionary of AI-generated news summaries for each stock.
        technical_analysis: A dictionary of AI-generated technical analysis for each stock.

    Returns:
        A dictionary containing the portfolio summary and a list of recommendations.
    """
    print(f"\n[Agent 5] Generating Portfolio Recommendations using LLM ({LLM_MODEL})...")
    
    # 2. Build the prompt
    prompt_parts = [SYSTEM_INSTRUCTION]
    prompt_parts.append("Current Portfolio:")
    prompt_parts.append(portfolio.to_json())

    # Add truncated summaries and technical analysis to the prompt
    for symbol in portfolio.get_symbols():
        news_summary = summaries.get(symbol, "No news summary available.")
        tech_analysis = technical_analysis.get(symbol, "No technical analysis available.")
        
        # Truncate each input to a max length to keep the prompt size manageable
        truncated_news = (news_summary[:400] + '...') if len(news_summary) > 400 else news_summary
        truncated_tech = (tech_analysis[:200] + '...') if len(tech_analysis) > 200 else tech_analysis
        
        prompt_parts.append(f"\nAnalysis for {symbol}:")
        prompt_parts.append(f"News Summary: {truncated_news}")
        prompt_parts.append(f"Technical Analysis: {truncated_tech}")

    final_prompt = "\n".join(prompt_parts)
    
    # 3. Call the Gemini API
    try:
        # Use the more powerful 'gemini-1.5-pro' model for the final, most complex reasoning task
        response_text = call_gemini_api(final_prompt, model='gemini-2.5-pro')
        
        # Clean up the response text before parsing
        # The model sometimes returns the JSON wrapped in ```json ... ```
        cleaned_response_text = response_text.strip().replace('```json', '').replace('```', '')
        recommendations = json.loads(cleaned_response_text)
        
    except Exception as e:
        print(f"Error during Gemini API call for recommendations: {e}")
        recommendations = {
            "portfolio_summary": "Failed to generate recommendations due to an API error.",
            "recommendations": []
        }
        
    return recommendations
