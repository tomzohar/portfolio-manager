"""
Pydantic Schemas for Autonomous Agent

Defines the data structures for validating and parsing the agent's
LLM responses. Using Pydantic ensures that the agent's decisions
adhere to a strict, expected format, which is critical for
reliable tool execution and error handling.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List


class PortfolioPosition(BaseModel):
    """Represents a single stock position in the portfolio."""
    symbol: str
    price: float
    position: int  # number of shares
    market_value: float
    percent_of_total: float

    class Config:
        """Pydantic config."""
        frozen = True


class Portfolio(BaseModel):
    """Represents the complete portfolio."""
    positions: List[PortfolioPosition]
    total_value: float

    def to_dict(self) -> Dict:
        """Converts portfolio to dictionary format."""
        return {
            "total_value": self.total_value,
            "positions": [pos.model_dump() for pos in self.positions]
        }


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
