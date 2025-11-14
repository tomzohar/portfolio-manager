#!/usr/bin/env python3
"""
LLM Utilities
Provides a centralized, retry-enabled function for calling the Gemini API.
"""

from google import genai
from tenacity import retry, stop_after_attempt, wait_exponential
from ..config import GEMINI_API_KEY

# Initialize the Gemini client in a centralized place
try:
    client = genai.Client(api_key=GEMINI_API_KEY)
    # Using a common, robust model
    LLM_MODEL = 'gemini-2.5-flash'
except Exception as e:
    print(f"CRITICAL: Failed to initialize Gemini client: {e}")
    raise

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def call_gemini_api(prompt: str, model: str = None) -> str:
    """
    Calls the Gemini API with a given prompt and handles retries automatically.

    Args:
        prompt: The full prompt to send to the LLM.
        model: The specific model to use (optional, defaults to the one defined in this module).

    Returns:
        The text response from the LLM.
    """
    model_to_use = model or LLM_MODEL
    print(f"  -> Calling Gemini API with model: {model_to_use}...")
    
    response = client.models.generate_content(
        model=model_to_use,
        contents=prompt
    )
    return response.text
