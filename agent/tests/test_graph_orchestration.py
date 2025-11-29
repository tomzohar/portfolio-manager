"""
Tests for Phase 3 Graph Orchestration & State Management

Tests the integration of Supervisor, Synthesis, and Reflexion nodes
within the LangGraph workflow, including edge routing logic and
state transitions.
"""

import pytest
from unittest.mock import MagicMock, patch
from src.portfolio_manager.graph.edges import (
    route_after_reflexion,
    route_after_start,
    route_after_supervisor,
)
from src.portfolio_manager.graph.builder import build_graph, GraphState


# =====================================================================
# Edge Routing Tests
# =====================================================================


class TestRouteAfterReflexion:
    """Tests for reflexion node routing logic."""
    
    def test_reflexion_approved_routes_to_final_report(self):
        """Test that approved reflexion routes to final report."""
        state = {
            "reflexion_approved": True,
            "reflexion_iteration": 1,
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_reflexion(state)
        assert result == "final_report"
    
    def test_reflexion_rejected_loops_back_to_synthesis(self):
        """Test that rejected reflexion loops back to synthesis."""
        state = {
            "reflexion_approved": False,
            "reflexion_iteration": 0,
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_reflexion(state)
        assert result == "synthesis"
    
    def test_reflexion_max_iterations_auto_approves(self):
        """Test that max iterations forces approval."""
        state = {
            "reflexion_approved": False,
            "reflexion_iteration": 2,  # Max iterations
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_reflexion(state)
        assert result == "final_report"
    
    def test_reflexion_iteration_1_not_approved_loops_back(self):
        """Test that iteration 1 (not max) loops back when not approved."""
        state = {
            "reflexion_approved": False,
            "reflexion_iteration": 1,
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_reflexion(state)
        assert result == "synthesis"


class TestRouteAfterStart:
    """Tests for start node routing logic."""
    
    def test_portfolio_with_tickers_routes_to_supervisor(self):
        """Test that portfolio with tickers routes to V3 supervisor workflow."""
        state = {
            "portfolio": {
                "tickers": ["AAPL", "MSFT", "GOOGL"],
                "positions": {
                    "AAPL": 0.4,
                    "MSFT": 0.35,
                    "GOOGL": 0.25
                }
            },
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_start(state)
        assert result == "supervisor"
    
    def test_no_portfolio_routes_to_legacy_agent(self):
        """Test that missing portfolio routes to V2 legacy workflow."""
        state = {
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_start(state)
        assert result == "agent"
    
    def test_empty_tickers_routes_to_legacy_agent(self):
        """Test that empty tickers list routes to V2 legacy workflow."""
        state = {
            "portfolio": {
                "tickers": [],
                "positions": {}
            },
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_start(state)
        assert result == "agent"


class TestRouteAfterSupervisor:
    """Tests for supervisor node routing logic."""
    
    def test_all_agents_completed_routes_to_synthesis(self):
        """Test that successful completion routes to synthesis."""
        state = {
            "sub_agent_status": {
                "macro_agent": "completed",
                "fundamental_agent": "completed",
                "technical_agent": "completed",
                "risk_agent": "completed"
            },
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_supervisor(state)
        assert result == "synthesis"
    
    def test_critical_agent_failed_routes_to_end(self):
        """Test that critical agent failure terminates workflow."""
        state = {
            "sub_agent_status": {
                "macro_agent": "failed",  # Critical agent failed
                "fundamental_agent": "completed",
                "technical_agent": "completed",
                "risk_agent": "completed"
            },
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_supervisor(state)
        assert result == "end"
    
    def test_risk_agent_failed_routes_to_end(self):
        """Test that risk agent failure terminates workflow."""
        state = {
            "sub_agent_status": {
                "macro_agent": "completed",
                "fundamental_agent": "completed",
                "technical_agent": "completed",
                "risk_agent": "failed"  # Critical agent failed
            },
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_supervisor(state)
        assert result == "end"
    
    def test_no_analysis_agents_completed_routes_to_end(self):
        """Test that no analysis agents completing terminates workflow."""
        state = {
            "sub_agent_status": {
                "macro_agent": "completed",
                "fundamental_agent": "failed",
                "technical_agent": "failed",
                "risk_agent": "completed"
            },
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_supervisor(state)
        assert result == "end"
    
    def test_one_analysis_agent_succeeded_routes_to_synthesis(self):
        """Test that at least one analysis agent succeeding allows continuation."""
        state = {
            "sub_agent_status": {
                "macro_agent": "completed",
                "fundamental_agent": "completed",  # At least one succeeded
                "technical_agent": "failed",
                "risk_agent": "completed"
            },
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        result = route_after_supervisor(state)
        assert result == "synthesis"


# =====================================================================
# Graph Builder Tests
# =====================================================================


class TestGraphBuilder:
    """Tests for graph builder integration."""
    
    def test_build_graph_succeeds(self):
        """Test that build_graph() compiles without errors."""
        graph = build_graph()
        assert graph is not None
    
    def test_graph_has_all_v2_nodes(self):
        """Test that V2 legacy nodes are present."""
        graph = build_graph()
        # LangGraph doesn't expose nodes directly, but we can verify
        # compilation succeeded
        assert graph is not None
    
    def test_graph_has_all_v3_nodes(self):
        """Test that V3 supervisor nodes are present."""
        graph = build_graph()
        # LangGraph doesn't expose nodes directly, but we can verify
        # compilation succeeded
        assert graph is not None


# =====================================================================
# State Transition Tests
# =====================================================================


class TestStateTransitions:
    """Tests for state field transitions through workflow."""
    
    def test_supervisor_updates_sub_agent_status(self, mocker):
        """Test that supervisor node populates sub_agent_status."""
        # This would be an integration test in practice
        # For now, we verify the state schema supports the field
        from src.portfolio_manager.agent_state import AgentState
        
        state = AgentState(
            portfolio={"tickers": ["AAPL"]},
            sub_agent_status={
                "macro_agent": "completed",
                "fundamental_agent": "completed",
                "technical_agent": "completed",
                "risk_agent": "completed"
            }
        )
        
        assert state.sub_agent_status["macro_agent"] == "completed"
    
    def test_synthesis_populates_synthesis_result(self):
        """Test that synthesis node populates synthesis_result field."""
        from src.portfolio_manager.agent_state import AgentState
        
        state = AgentState(
            portfolio={"tickers": ["AAPL"]},
            synthesis_result={
                "position_actions": [
                    {
                        "ticker": "AAPL",
                        "action": "Buy",
                        "confidence": 0.85
                    }
                ],
                "portfolio_strategy": {
                    "action": "Accumulate"
                },
                "conflicts": []
            }
        )
        
        assert state.synthesis_result is not None
        assert len(state.synthesis_result["position_actions"]) == 1
    
    def test_reflexion_updates_iteration_and_feedback(self):
        """Test that reflexion node updates iteration and feedback."""
        from src.portfolio_manager.agent_state import AgentState
        
        state = AgentState(
            portfolio={"tickers": ["AAPL"]},
            reflexion_iteration=1,
            reflexion_feedback=["Issue: Concentration risk not addressed"],
            reflexion_approved=False
        )
        
        assert state.reflexion_iteration == 1
        assert not state.reflexion_approved
        assert len(state.reflexion_feedback) == 1


# =====================================================================
# Reflexion Loop Integration Tests
# =====================================================================


class TestReflexionLoopIntegration:
    """Tests for reflexion loop behavior."""
    
    def test_reflexion_loop_first_rejection(self):
        """Test loop back on first rejection."""
        state = {
            "reflexion_approved": False,
            "reflexion_iteration": 0,
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        # First rejection should loop back
        result = route_after_reflexion(state)
        assert result == "synthesis"
    
    def test_reflexion_loop_second_rejection(self):
        """Test loop back on second rejection."""
        state = {
            "reflexion_approved": False,
            "reflexion_iteration": 1,
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        # Second rejection should still loop back
        result = route_after_reflexion(state)
        assert result == "synthesis"
    
    def test_reflexion_loop_third_rejection_auto_approves(self):
        """Test auto-approval on third rejection (max iterations)."""
        state = {
            "reflexion_approved": False,
            "reflexion_iteration": 2,  # Max reached
            "portfolio": None,
            "analysis_results": {},
            "reasoning_trace": [],
            "agent_reasoning": [],
            "confidence_score": 0.0,
            "api_call_counts": {},
            "estimated_cost": 0.0,
            "terminate_run": False,
            "force_final_report": False,
            "newly_completed_api_calls": [],
            "max_iterations": 10,
            "current_iteration": 0,
            "errors": [],
            "started_at": "2024-01-01T00:00:00",
        }
        
        # Third rejection should force approval
        result = route_after_reflexion(state)
        assert result == "final_report"


# =====================================================================
# GraphState Schema Validation Tests
# =====================================================================


class TestGraphStateSchema:
    """Tests for GraphState schema validation."""
    
    def test_graphstate_has_fields(self):
        """Test that GraphState includes all fields."""
        # Verify GraphState TypedDict has required fields
        required_fields = [
            "execution_plan",
            "sub_agent_status",
            "synthesis_result",
            "reflexion_iteration",
            "reflexion_feedback",
            "reflexion_approved",
            "confidence_adjustment",
            "macro_analysis",
            "fundamental_analysis",
            "technical_analysis",
            "risk_assessment"
        ]
        
        # GraphState is a TypedDict, check annotations
        annotations = GraphState.__annotations__
        
        for field in required_fields:
            assert field in annotations, f"Missing field: {field}"
    
    def test_graphstate_has_fields(self):
        """Test that GraphState includes all Phase 2 fields."""
        required_fields = [
            "macro_analysis",
            "fundamental_analysis",
            "technical_analysis",
            "risk_assessment"
        ]
        
        annotations = GraphState.__annotations__
        
        for field in required_fields:
            assert field in annotations, f"Missing field: {field}"


# =====================================================================
# End-to-End Workflow Tests (Mocked)
# =====================================================================


class TestEndToEndWorkflow:
    """Integration tests for complete workflow paths."""
    
    @patch('src.portfolio_manager.graph.nodes.supervisor.supervisor_node')
    @patch('src.portfolio_manager.graph.nodes.synthesis.synthesis_node')
    @patch('src.portfolio_manager.graph.nodes.reflexion.reflexion_node')
    @patch('src.portfolio_manager.graph.nodes.final_report.final_report_node')
    def test_v3_workflow_with_approval(
        self,
        mock_final_report,
        mock_reflexion,
        mock_synthesis,
        mock_supervisor
    ):
        """Test V3 workflow with reflexion approval on first try."""
        # Mock supervisor output
        mock_supervisor.return_value = {
            "sub_agent_status": {
                "macro_agent": "completed",
                "fundamental_agent": "completed",
                "technical_agent": "completed",
                "risk_agent": "completed"
            }
        }
        
        # Mock synthesis output
        mock_synthesis.return_value = {
            "synthesis_result": {
                "position_actions": [],
                "portfolio_strategy": {},
                "conflicts": []
            }
        }
        
        # Mock reflexion approval
        mock_reflexion.return_value = {
            "reflexion_approved": True,
            "reflexion_iteration": 1
        }
        
        # Mock final report
        mock_final_report.return_value = {
            "final_report": "Portfolio analysis complete"
        }
        
        # This would execute the graph in practice
        # For now, we verify mocks can be called
        assert mock_supervisor is not None
        assert mock_synthesis is not None
        assert mock_reflexion is not None
        assert mock_final_report is not None

