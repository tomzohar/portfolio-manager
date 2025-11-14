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
    
    # 1. Format portfolio data for the prompt
    portfolio_data = {
        "total_value": portfolio.total_value,
        "positions": [
            {
                "ticker": pos.symbol,
                "value": pos.market_value,
                "percentage": pos.percent_of_total
            }
            for pos in portfolio.positions
        ]
    }
    
    # 2. Create the User Prompt
    user_prompt = f"""
    **Portfolio:**
    ```json
    {json.dumps(portfolio_data, indent=2)}
    ```

    **News Summaries:**
    ```json
    {json.dumps(summaries, indent=2)}
    ```

    **Technical Analysis:**
    ```json
    {json.dumps(technical_analysis, indent=2)}
    ```
    """
    
    # 3. Call the Gemini API
    try:
        full_prompt = SYSTEM_INSTRUCTION + "\n\n" + user_prompt
        response_text = call_gemini_api(full_prompt)
        
        # Clean up the response text before parsing
        # The API sometimes returns the JSON wrapped in markdown
        cleaned_response_text = response_text.strip().replace('```json', '').replace('```', '')
        recommendations = json.loads(cleaned_response_text)
        
    except Exception as e:
        print(f"Error during Gemini API call for recommendations: {e}")
        recommendations = {
            "portfolio_summary": "Failed to generate recommendations due to an API error.",
            "recommendations": []
        }
        
    return recommendations
