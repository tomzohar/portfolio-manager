"""
Pydantic Schemas for Autonomous Agent

Defines the data structures for validating and parsing the agent's
LLM responses. Using Pydantic ensures that the agent's decisions
adhere to a strict, expected format, which is critical for
reliable tool execution and error handling.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional


class AgentDecision(BaseModel):
    """
    Schema for the agent's decision response.
    
    This Pydantic model validates the JSON object that the agent is expected
    to return. It ensures the response contains the necessary fields for
    the graph to decide the next action.
    """
    reasoning: str = Field(description="Brief explanation of why the agent chose this action")
    action: str = Field(description="The name of the tool to call, or 'generate_report' to finish")
    arguments: Optional[Dict[str, Any]] = Field(
        default={},
        description="The arguments to pass to the tool"
    )
