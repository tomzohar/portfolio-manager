"""
LLM Response Parsers for Autonomous Agent

This module provides robust functions for parsing and validating the
string-based responses from the Language Model (LLM). The primary goal
is to safely extract a structured JSON object from a potentially messy
LLM output that might include markdown formatting, conversational text,
or other noise.
"""

import json
import re
from typing import Dict, Any
import logging

from .tool_registry import list_tools

logger = logging.getLogger(__name__)


def parse_agent_decision(llm_response: str) -> Dict[str, Any]:
    """
    Parse the LLM's string response into a structured agent decision dictionary.
    
    This function is designed to be highly robust to variations in the LLM's
    output format. It intelligently searches for a JSON object within the
    response, whether it's plain, wrapped in markdown code blocks, or embedded
    in surrounding text. It then validates this JSON against the expected
    structure for an agent's action.
    
    Args:
        llm_response: The raw string output from the language model.
        
    Returns:
        A dictionary representing the agent's decision, with keys for
        "reasoning", "action", and "arguments".
        
    Raises:
        ValueError: If a valid JSON object representing a legitimate
                    agent decision cannot be found in the response.
    """
    logger.debug(f"Parsing LLM response: {llm_response}")
    
    # First, try to find a JSON object wrapped in markdown code blocks
    json_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
    match = re.search(json_pattern, llm_response, re.DOTALL)
    
    if match:
        json_str = match.group(1)
        logger.debug("Found JSON in markdown block.")
    else:
        # If no markdown block, try to find the first complete JSON object
        json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        match = re.search(json_pattern, llm_response, re.DOTALL)
        if match:
            json_str = match.group(0)
            logger.debug("Found JSON object directly in response.")
        else:
            logger.error(f"No JSON object found in LLM response: {llm_response[:200]}")
            raise ValueError(f"No valid JSON object found in the response: {llm_response[:200]}")

    try:
        # Attempt to parse the extracted JSON string
        decision = json.loads(json_str)
        
        # Validate the structure of the parsed decision
        if "action" not in decision:
            raise ValueError("The 'action' field is missing from the agent's decision.")
            
        # Ensure the action is a known tool or the special 'generate_report' command
        valid_actions = list_tools() + ["generate_report"]
        if decision["action"] not in valid_actions:
            raise ValueError(
                f"Unknown action '{decision['action']}'. "
                f"Valid actions are: {', '.join(valid_actions)}"
            )
            
        # Ensure 'arguments' field exists, defaulting to an empty dict if not present
        if "arguments" not in decision:
            decision["arguments"] = {}
            
        # Ensure 'reasoning' field exists, defaulting to an empty string
        if "reasoning" not in decision:
            decision["reasoning"] = ""

        logger.info(f"Successfully parsed agent action: {decision['action']}")
        return decision
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON detected: {e}\nJSON string was: {json_str}")
        raise ValueError(f"Failed to decode JSON from the response: {e}")
