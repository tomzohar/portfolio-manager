"""
Agent State Schema

Defines the state structure for the autonomous portfolio manager agent.
The state is passed between nodes in the LangGraph and serves as the single
source of truth for the entire workflow.
"""

from typing import TypedDict, List, Dict, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import uuid


@dataclass
class ToolResult:
    """Standardized result format for all tools."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    confidence_impact: float = 0.0
    state_patch: Dict[str, Any] = field(default_factory=dict)
    api_calls: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ToolCall:
    """Represents a single call to a tool."""
    tool: str
    args: Dict[str, Any]
    timestamp: str
    success: bool
    output: Optional[Any]


class AgentState(TypedDict):
    """
    Complete state for the autonomous portfolio manager agent.
    
    This state is passed between all nodes in the LangGraph and contains:
    - Portfolio data from Google Sheets
    - Accumulated analysis results (news, technical indicators)
    - Agent reasoning trace for observability
    - Confidence metrics
    - Iteration tracking for loop control
    """
    # Portfolio data (populated by parse_portfolio tool)
    portfolio: Optional[Dict[str, Any]]  # Will contain the Portfolio dataclass as dict
    
    # Analysis results keyed by ticker symbol
    # Structure: {
    #   "AAPL": {
    #     "news": {...},
    #     "technicals": {...},
    #   }
    # }
    analysis_results: Dict[str, Dict[str, Any]]
    
    # Agent's reasoning trace (for observability and debugging)
    # Each entry is a string describing what the agent decided and why
    reasoning_trace: List[str]
    
    # NEW: Structured agent decision tracking
    # Full reasoning history from the LLM, including action and raw response
    agent_reasoning: List[Dict[str, Any]]
    
    # The next tool call decided by the agent, to be executed by the tool_executor_node
    # Format: {"tool": "tool_name", "args": {"param": "value"}}
    next_tool_call: Optional[Dict[str, Any]]
    current_tool_name: Optional[str] = None
    current_tool_args: Optional[Dict[str, Any]] = None
    
    # Confidence score (0.0 to 1.0)
    # Updated after each tool execution, used to determine when to stop iterating
    confidence_score: float
    
    # Tool call history (for replay and debugging)
    tool_calls: List[ToolCall]
    latest_tool_result: Optional[ToolResult] = None
    
    # Cost Control Guardrails
    api_call_counts: Dict[str, int]
    estimated_cost: float
    terminate_run: bool
    force_final_report: bool # NEW: Flag to signal graceful termination
    newly_completed_api_calls: List[Dict[str, Any]] # Staging area for calls from the last step
    
    # Loop control
    max_iterations: int
    current_iteration: int
    
    # Final output (only populated by the terminal node)
    final_report: Optional[str]
    
    # Error tracking
    errors: List[str]
    
    # Metadata
    started_at: Optional[str]
    completed_at: Optional[str]


def create_initial_state(max_iterations: int = 10) -> AgentState:
    """
    Create a fresh AgentState for a new analysis run.
    
    Args:
        max_iterations: Maximum number of agent decision loops (default: 10)
    
    Returns:
        An initialized AgentState with default values
    """
    return AgentState(
        portfolio=None,
        analysis_results={},
        reasoning_trace=[],
        agent_reasoning=[],
        next_tool_call=None,
        current_tool_name=None,
        current_tool_args={},
        confidence_score=0.0,
        tool_calls=[],
        latest_tool_result=None,
        max_iterations=max_iterations,
        current_iteration=0,
        final_report=None,
        errors=[],
        started_at=datetime.utcnow().isoformat(),
        completed_at=None,
        api_call_counts={},
        estimated_cost=0.0,
        newly_completed_api_calls=[],
        terminate_run=False,
        force_final_report=False,
    )

