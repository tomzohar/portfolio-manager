#!/usr/bin/env python3
"""
Portfolio Manager Agent
Analyzes portfolio and news summaries to generate actionable trading recommendations
"""

import json
from google import genai
from typing import Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential
from ..config import GEMINI_API_KEY
from .portfolio_parser import Portfolio

# Initialize the Gemini client
try:
    client = genai.Client(api_key=GEMINI_API_KEY)
    LLM_MODEL = 'gemini-2.5-pro'
except Exception as e:
    print(f"Error initializing Gemini client: {e}")
    raise

SYSTEM_INSTRUCTION = (
    "You are an expert financial analyst and portfolio manager. Your task is to provide actionable "
    "recommendations based on a client's stock portfolio and the latest news summaries for each holding. "
    "Analyze each stock in light of its news summary and its current weight in the portfolio. "
    "Provide a clear recommendation for each stock: INCREASE, DECREASE, or HOLD. "
    "For any INCREASE or DECREASE recommendation, provide concise reasoning based strictly on the provided "
    "news and portfolio context. Suggest a specific action, for example: 'Decrease position from 15% to 10%'. "
    "If you recommend decreasing a position, suggest reallocating the capital to another promising stock "
    "*already in the portfolio*. Provide a final high-level summary of your overall assessment of the portfolio. "
    "Your final output MUST be a JSON object with two keys: 'portfolio_summary' (a string) and "
    "'recommendations' (a list of recommendation objects). Do not include HOLD recommendations in the list."
    "\n\n**IMPORTANT CONSTRAINTS:**"
    "\n- The total JSON output must be under 1500 characters."
    "\n- The `portfolio_summary` must be a concise, high-level overview, MAXIMUM 400 characters."
    "\n- The `reasoning` for each recommendation must be a single, brief sentence, MAXIMUM 150 characters."
)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def _call_gemini_api_with_retry(prompt: str) -> str:
    """Calls the Gemini API with retry logic."""
    response = client.models.generate_content(
        model=LLM_MODEL,
        contents=prompt
    )
    return response.text


def generate_portfolio_recommendations(portfolio: Portfolio, summaries: Dict[str, str]) -> Dict[str, Any]:
    """
    Generates trading recommendations based on portfolio and news summaries.

    Args:
        portfolio: The user's current portfolio object.
        summaries: A dictionary of AI-generated news summaries for each stock.

    Returns:
        A dictionary containing the portfolio summary and a list of recommendations.
    """
    print(f"\n[Agent 4] Generating Portfolio Recommendations using LLM ({LLM_MODEL})...")
    
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
    """
    
    # 3. Call the Gemini API
    try:
        full_prompt = SYSTEM_INSTRUCTION + "\n\n" + user_prompt
        response_text = _call_gemini_api_with_retry(full_prompt)
        
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
