#!/usr/bin/env python3
"""
LLM Utilities
Provides a centralized, retry-enabled function for calling the Gemini API.
"""

from google import genai
from tenacity import retry, stop_after_attempt, wait_exponential
from src.portfolio_manager.config import settings

# Using a common, robust model
LLM_MODEL = 'gemini-2.5-flash'

# Lazy initialization - client is created only when first needed
_client = None

def _get_gemini_client():
    """
    Lazy initialization of the Gemini client.
    Only creates the client when first called, not at module import time.
    This allows tests to import the module without needing API keys.
    """
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set. Please configure it in your environment.")
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def call_gemini_api(prompt: str, model: str = None, **kwargs) -> str:
    """
    Calls the Gemini API with a given prompt and handles retries automatically.

    Args:
        prompt: The full prompt to send to the LLM.
        model: The specific model to use (optional, defaults to the one defined in this module).
        **kwargs: Additional generation config parameters (e.g., temperature, top_p, top_k, max_output_tokens).

    Returns:
        The text response from the LLM.
    """
    model_to_use = model or LLM_MODEL
    print(f"  -> Calling Gemini API with model: {model_to_use}...")
    
    # Build generation config from kwargs if provided
    generation_config = {}
    if 'temperature' in kwargs:
        generation_config['temperature'] = kwargs['temperature']
    if 'top_p' in kwargs:
        generation_config['top_p'] = kwargs['top_p']
    if 'top_k' in kwargs:
        generation_config['top_k'] = kwargs['top_k']
    if 'max_output_tokens' in kwargs:
        generation_config['max_output_tokens'] = kwargs['max_output_tokens']
    
    client = _get_gemini_client()
    
    # Call API with or without generation config
    if generation_config:
        response = client.models.generate_content(
            model=model_to_use,
            contents=prompt,
            config=generation_config
        )
    else:
        response = client.models.generate_content(
            model=model_to_use,
            contents=prompt
        )
    
    return response.text
