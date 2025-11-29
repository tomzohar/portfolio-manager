"""
Agent State Schema

Defines the state structure for the autonomous portfolio manager agent using
Pydantic for runtime validation. The state is passed between nodes in the
LangGraph and serves as the single source of truth for the entire workflow.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ToolResult(BaseModel):
    """Standardized result format for all tools."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    confidence_impact: float = 0.0
    state_patch: Dict[str, Any] = Field(default_factory=dict)
    api_calls: List[Dict[str, Any]] = Field(default_factory=list)


class ToolCall(BaseModel):
    """Represents a single call to a tool."""
    tool: str
    args: Dict[str, Any]
    timestamp: str
    success: bool
    output: Optional[Any]


class AgentState(BaseModel):
    """
    Complete state for the autonomous portfolio manager agent.
    
    This Pydantic model ensures runtime validation of the state as it is
    passed between all nodes in the LangGraph.
    """
    # Portfolio data
    portfolio: Optional[Dict[str, Any]] = None
    
    # Analysis results keyed by ticker symbol
    analysis_results: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    
    # Agent's reasoning trace
    reasoning_trace: List[str] = Field(default_factory=list)
    agent_reasoning: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Tool call management
    next_tool_call: Optional[Dict[str, Any]] = None
    tool_calls: List[ToolCall] = Field(default_factory=list)
    latest_tool_result: Optional[ToolResult] = None
    
    # Confidence score (0.0 to 1.0)
    confidence_score: float = 0.0
    
    # Cost Control Guardrails
    api_call_counts: Dict[str, int] = Field(default_factory=dict)
    estimated_cost: float = 0.0
    terminate_run: bool = False
    force_final_report: bool = False
    newly_completed_api_calls: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Loop control
    max_iterations: int = 10
    current_iteration: int = 0
    
    # Final output
    final_report: Optional[str] = None
    
    # Error tracking
    errors: List[str] = Field(default_factory=list)
    
    # Metadata
    started_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None
    
    # Phase 2: Sub-Agent Outputs (V3 Multi-Agent Architecture)
    macro_analysis: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Macro Agent output (market regime, risk appetite)"
    )
    fundamental_analysis: Dict[str, Any] = Field(
        default_factory=dict,
        description="Fundamental Agent outputs per ticker"
    )
    technical_analysis: Dict[str, Any] = Field(
        default_factory=dict,
        description="Technical Agent outputs per ticker"
    )
    risk_assessment: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Risk Agent output (portfolio risk metrics)"
    )
    
    # Phase 3: Supervisor Orchestration & Reflexion
    execution_plan: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Supervisor's decomposed execution plan"
    )
    sub_agent_status: Dict[str, str] = Field(
        default_factory=dict,
        description="Completion status of each sub-agent (e.g., {'macro_agent': 'completed'})"
    )
    synthesis_result: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Synthesis Node's combined recommendations"
    )
    reflexion_iteration: int = Field(
        default=0,
        description="Current reflexion loop iteration count"
    )
    reflexion_feedback: List[str] = Field(
        default_factory=list,
        description="Critique feedback from Reflexion Node"
    )
    reflexion_approved: bool = Field(
        default=False,
        description="Whether Reflexion Node approved synthesis"
    )
    confidence_adjustment: float = Field(
        default=0.0,
        description="Confidence adjustment from reflexion critique"
    )

    class Config:
        """Allow extra fields for LangGraph internal state."""
        extra = 'allow'

