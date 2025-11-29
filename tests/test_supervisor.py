"""
Test Suite for Supervisor Node - Phase 3

Tests the Supervisor Node which orchestrates multi-agent portfolio analysis
by delegating to specialized sub-agents (Macro, Fundamental, Technical, Risk).
"""

import pytest
from unittest.mock import MagicMock, patch
from src.portfolio_manager.graph.nodes.supervisor import (
    supervisor_node,
    _create_execution_plan,
    _execute_plan,
    _batch_process_tickers
)
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.schemas import ExecutionPlan


@pytest.fixture
def sample_portfolio_state():
    """Sample portfolio state with 3 positions."""
    return AgentState(
        portfolio={
            "tickers": ["AAPL", "MSFT", "GOOGL"],
            "positions": {
                "AAPL": {"weight": 0.4, "shares": 100},
                "MSFT": {"weight": 0.35, "shares": 80},
                "GOOGL": {"weight": 0.25, "shares": 50}
            }
        },
        reasoning_trace=[]
    )


@pytest.fixture
def sample_execution_plan():
    """Sample execution plan."""
    return ExecutionPlan(
        tasks=[
            "Invoke Macro Agent to establish market context",
            "Invoke Fundamental Agent for each ticker (batch)",
            "Invoke Technical Agent for each ticker (batch)",
            "Invoke Risk Agent to calculate portfolio metrics"
        ],
        parallel_groups=[["Fundamental Agent", "Technical Agent"]],
        rationale="Standard portfolio analysis: macro first, then parallel ticker analysis, then risk"
    )


class TestSupervisorNode:
    """Test suite for supervisor_node main function."""
    
    def test_supervisor_creates_execution_plan(self, sample_portfolio_state, mocker):
        """Test supervisor creates execution plan."""
        # Mock all sub-agent nodes
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            return_value={"macro_analysis": {"status": "Goldilocks", "signal": "Risk-On"}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            return_value={"fundamental_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            return_value={"technical_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            return_value={"risk_assessment": {"beta": 1.1}}
        )
        
        # Mock LLM for planning
        mock_llm_response = """
{
  "tasks": [
    "Invoke Macro Agent to establish market context",
    "Invoke Fundamental Agent for each ticker (batch)",
    "Invoke Technical Agent for each ticker (batch)",
    "Invoke Risk Agent to calculate portfolio metrics"
  ],
  "parallel_groups": [["Fundamental Agent", "Technical Agent"]],
  "rationale": "Standard portfolio analysis workflow"
}
"""
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = supervisor_node(sample_portfolio_state)
        
        # Assert execution plan created
        assert "execution_plan" in result
        assert result["execution_plan"] is not None
        assert "tasks" in result["execution_plan"]
        assert len(result["execution_plan"]["tasks"]) >= 4
    
    def test_supervisor_delegates_to_all_agents(self, sample_portfolio_state, mocker):
        """Test supervisor calls all 4 sub-agents."""
        # Mock sub-agent nodes
        mock_macro = mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            return_value={"macro_analysis": {"status": "Goldilocks"}}
        )
        mock_fundamental = mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            return_value={"fundamental_analysis": {"AAPL": {}}}
        )
        mock_technical = mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            return_value={"technical_analysis": {"AAPL": {}}}
        )
        mock_risk = mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            return_value={"risk_assessment": {"beta": 1.1}}
        )
        
        # Mock LLM
        mock_llm_response = """
{
  "tasks": ["Macro", "Fundamental", "Technical", "Risk"],
  "parallel_groups": [],
  "rationale": "Test plan"
}
"""
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = supervisor_node(sample_portfolio_state)
        
        # Assert all agents called
        assert mock_macro.called
        assert mock_fundamental.called
        assert mock_technical.called
        assert mock_risk.called
        
        # Assert status tracking
        assert "sub_agent_status" in result
        assert result["sub_agent_status"]["macro_agent"] == "completed"
        assert result["sub_agent_status"]["fundamental_agent"] == "completed"
        assert result["sub_agent_status"]["technical_agent"] == "completed"
        assert result["sub_agent_status"]["risk_agent"] == "completed"
    
    def test_supervisor_handles_agent_failures(self, sample_portfolio_state, mocker):
        """Test supervisor continues when one agent fails."""
        # Mock macro agent to fail
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            side_effect=Exception("Macro agent failure")
        )
        
        # Mock other agents to succeed
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            return_value={"fundamental_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            return_value={"technical_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            return_value={"risk_assessment": {"beta": 1.1}}
        )
        
        # Mock LLM
        mock_llm_response = """
{
  "tasks": ["Macro", "Fundamental", "Technical", "Risk"],
  "parallel_groups": [],
  "rationale": "Test"
}
"""
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = supervisor_node(sample_portfolio_state)
        
        # Assert supervisor continued with other agents
        assert "sub_agent_status" in result
        assert result["sub_agent_status"]["macro_agent"] == "failed"
        assert result["sub_agent_status"]["fundamental_agent"] == "completed"
        assert result["sub_agent_status"]["technical_agent"] == "completed"
        assert result["sub_agent_status"]["risk_agent"] == "completed"
        
        # Assert macro_analysis set to None
        assert result["macro_analysis"] is None
    
    def test_supervisor_tracks_completion_status(self, sample_portfolio_state, mocker):
        """Test supervisor tracks completion status of all agents."""
        # Mock all agents
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            return_value={"macro_analysis": {"status": "Goldilocks"}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            return_value={"fundamental_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            return_value={"technical_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            return_value={"risk_assessment": {"beta": 1.1}}
        )
        
        # Mock LLM
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value='{"tasks": ["Test"], "parallel_groups": [], "rationale": "Test"}'
        )
        
        # Execute
        result = supervisor_node(sample_portfolio_state)
        
        # Assert sub_agent_status exists
        assert "sub_agent_status" in result
        assert isinstance(result["sub_agent_status"], dict)
        
        # Assert all agents marked as completed
        assert len(result["sub_agent_status"]) == 4
        for agent, status in result["sub_agent_status"].items():
            assert status in ["completed", "failed"]
    
    def test_supervisor_handles_missing_portfolio(self):
        """Test supervisor handles missing portfolio gracefully."""
        state = AgentState(
            portfolio=None,
            reasoning_trace=[]
        )
        
        result = supervisor_node(state)
        
        # Assert error handling
        assert "errors" in result
        assert len(result["errors"]) > 0
        assert "No portfolio data available" in result["errors"][0]
        assert result["execution_plan"] is None
    
    def test_supervisor_handles_empty_tickers(self):
        """Test supervisor handles empty tickers list."""
        state = AgentState(
            portfolio={"tickers": []},
            reasoning_trace=[]
        )
        
        result = supervisor_node(state)
        
        # Assert error handling
        assert "errors" in result
        assert "No tickers in portfolio" in result["errors"][0]
        assert result["execution_plan"] is None
    
    def test_supervisor_updates_reasoning_trace(self, sample_portfolio_state, mocker):
        """Test supervisor adds to reasoning trace."""
        # Mock all agents
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            return_value={"macro_analysis": {}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            return_value={"fundamental_analysis": {}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            return_value={"technical_analysis": {}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            return_value={"risk_assessment": {}}
        )
        
        # Mock LLM
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value='{"tasks": ["Test"], "parallel_groups": [], "rationale": "Test"}'
        )
        
        # Execute
        result = supervisor_node(sample_portfolio_state)
        
        # Assert reasoning trace updated
        assert "reasoning_trace" in result
        assert len(result["reasoning_trace"]) > len(sample_portfolio_state.reasoning_trace)
        assert any("Supervisor" in trace for trace in result["reasoning_trace"])


class TestCreateExecutionPlan:
    """Test suite for _create_execution_plan helper function."""
    
    def test_create_execution_plan_with_llm(self, mocker):
        """Test execution plan creation using LLM."""
        portfolio = {"tickers": ["AAPL", "MSFT", "GOOGL"]}
        
        # Mock LLM response
        mock_llm_response = """
{
  "tasks": [
    "Invoke Macro Agent to establish market context",
    "Invoke Fundamental Agent for each ticker (batch)",
    "Invoke Technical Agent for each ticker (batch)",
    "Invoke Risk Agent to calculate portfolio metrics"
  ],
  "parallel_groups": [["Fundamental Agent", "Technical Agent"]],
  "rationale": "Macro provides context, then parallel ticker analysis, then risk aggregation"
}
"""
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        plan = _create_execution_plan(portfolio, "Analyze my portfolio")
        
        # Assert plan created
        assert isinstance(plan, ExecutionPlan)
        assert len(plan.tasks) == 4
        assert "Macro Agent" in plan.tasks[0]
        assert len(plan.parallel_groups) == 1
        assert "Fundamental Agent" in plan.parallel_groups[0]
        assert len(plan.rationale) >= 20
    
    def test_create_execution_plan_fallback_on_parse_error(self, mocker):
        """Test execution plan falls back to default on JSON parse error."""
        portfolio = {"tickers": ["AAPL"]}
        
        # Mock LLM to return invalid JSON
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value="This is not valid JSON"
        )
        
        # Execute
        plan = _create_execution_plan(portfolio, "Analyze my portfolio")
        
        # Assert fallback plan used
        assert isinstance(plan, ExecutionPlan)
        assert len(plan.tasks) == 4  # Default plan has 4 tasks
        assert "fallback" in plan.rationale.lower()
    
    def test_create_execution_plan_with_large_portfolio(self, mocker):
        """Test execution plan with many tickers."""
        portfolio = {"tickers": [f"TICK{i}" for i in range(20)]}
        
        # Mock LLM
        mock_llm_response = """
{
  "tasks": ["Macro", "Fundamental", "Technical", "Risk"],
  "parallel_groups": [["Fundamental", "Technical"]],
  "rationale": "Large portfolio requires efficient parallel processing"
}
"""
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        plan = _create_execution_plan(portfolio, "Analyze my portfolio")
        
        # Assert plan handles large portfolio
        assert isinstance(plan, ExecutionPlan)
        assert "parallel" in plan.rationale.lower()


class TestExecutePlan:
    """Test suite for _execute_plan helper function."""
    
    def test_execute_plan_calls_all_agents_in_order(self, sample_portfolio_state, sample_execution_plan, mocker):
        """Test execution plan calls agents in correct order."""
        # Track call order
        call_order = []
        
        def track_macro(state):
            call_order.append("macro")
            return {"macro_analysis": {}}
        
        def track_fundamental(state):
            call_order.append("fundamental")
            return {"fundamental_analysis": {}}
        
        def track_technical(state):
            call_order.append("technical")
            return {"technical_analysis": {}}
        
        def track_risk(state):
            call_order.append("risk")
            return {"risk_assessment": {}}
        
        # Mock agents with tracking
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            side_effect=track_macro
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            side_effect=track_fundamental
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            side_effect=track_technical
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            side_effect=track_risk
        )
        
        # Execute
        result = _execute_plan(sample_portfolio_state, sample_execution_plan)
        
        # Assert correct order: Macro → Fundamental → Technical → Risk
        assert call_order == ["macro", "fundamental", "technical", "risk"]
    
    def test_execute_plan_handles_partial_failures(self, sample_portfolio_state, sample_execution_plan, mocker):
        """Test execution continues when some agents fail."""
        # Mock fundamental to fail, others to succeed
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            return_value={"macro_analysis": {"status": "Goldilocks"}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            side_effect=Exception("Fundamental agent error")
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            return_value={"technical_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            return_value={"risk_assessment": {"beta": 1.1}}
        )
        
        # Execute
        result = _execute_plan(sample_portfolio_state, sample_execution_plan)
        
        # Assert status reflects partial failure
        assert result["sub_agent_status"]["macro_agent"] == "completed"
        assert result["sub_agent_status"]["fundamental_agent"] == "failed"
        assert result["sub_agent_status"]["technical_agent"] == "completed"
        assert result["sub_agent_status"]["risk_agent"] == "completed"
        
        # Assert fundamental_analysis set to empty dict
        assert result["fundamental_analysis"] == {}
    
    def test_execute_plan_updates_state_incrementally(self, sample_portfolio_state, sample_execution_plan, mocker):
        """Test each agent receives updated state from previous agents."""
        received_states = []
        
        def capture_fundamental(state):
            received_states.append(("fundamental", state.macro_analysis))
            return {"fundamental_analysis": {"AAPL": {}}}
        
        def capture_risk(state):
            received_states.append(("risk", state.fundamental_analysis, state.technical_analysis))
            return {"risk_assessment": {"beta": 1.1}}
        
        # Mock agents
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.macro_agent_node',
            return_value={"macro_analysis": {"status": "Goldilocks"}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.fundamental_agent_node',
            side_effect=capture_fundamental
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.technical_agent_node',
            return_value={"technical_analysis": {"AAPL": {}}}
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.supervisor.risk_agent_node',
            side_effect=capture_risk
        )
        
        # Execute
        result = _execute_plan(sample_portfolio_state, sample_execution_plan)
        
        # Assert fundamental received macro analysis
        assert len(received_states) >= 1
        assert received_states[0][0] == "fundamental"
        assert received_states[0][1] is not None  # Has macro_analysis
        
        # Assert risk received both fundamental and technical
        if len(received_states) >= 2:
            assert received_states[1][0] == "risk"
            assert received_states[1][1] is not None  # Has fundamental_analysis
            assert received_states[1][2] is not None  # Has technical_analysis


class TestBatchProcessTickers:
    """Test suite for _batch_process_tickers helper function."""
    
    def test_batch_process_multiple_tickers(self, sample_portfolio_state, mocker):
        """Test batch processing isolates state per ticker."""
        tickers = ["AAPL", "MSFT", "GOOGL"]
        
        # Mock agent function
        def mock_agent(state):
            ticker = state.portfolio["tickers"][0]
            return {"analysis": {ticker: f"result_{ticker}"}}
        
        # Execute
        results = _batch_process_tickers(tickers, mock_agent, sample_portfolio_state)
        
        # Assert results per ticker
        assert len(results) == 3
        assert "AAPL" in results
        assert "MSFT" in results
        assert "GOOGL" in results
    
    def test_batch_process_handles_ticker_errors(self, sample_portfolio_state, mocker):
        """Test batch processing continues on ticker-level errors."""
        tickers = ["AAPL", "MSFT", "GOOGL"]
        
        # Mock agent to fail on MSFT
        def mock_agent(state):
            ticker = state.portfolio["tickers"][0]
            if ticker == "MSFT":
                raise Exception("MSFT analysis failed")
            return {"analysis": {ticker: f"result_{ticker}"}}
        
        # Execute
        results = _batch_process_tickers(tickers, mock_agent, sample_portfolio_state)
        
        # Assert MSFT has error, others succeed
        assert "AAPL" in results
        assert "analysis" in results["AAPL"]
        
        assert "MSFT" in results
        assert "error" in results["MSFT"]
        
        assert "GOOGL" in results
        assert "analysis" in results["GOOGL"]
    
    def test_batch_process_isolates_state(self, sample_portfolio_state):
        """Test batch processing doesn't mutate original state."""
        tickers = ["AAPL", "MSFT"]
        
        # Mock agent that modifies state
        def mock_agent(state):
            state.portfolio["tickers"].append("EXTRA")
            return {"analysis": {}}
        
        original_tickers = sample_portfolio_state.portfolio["tickers"].copy()
        
        # Execute
        _batch_process_tickers(tickers, mock_agent, sample_portfolio_state)
        
        # Assert original state unchanged
        assert sample_portfolio_state.portfolio["tickers"] == original_tickers

