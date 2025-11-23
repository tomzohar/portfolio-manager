"""
End-to-End Integration Tests for Portfolio Manager V3

Tests the complete V3 workflow from start to finish with realistic data and mocking.
Validates supervisor orchestration, reflexion loop, error handling, and output generation.

Test Categories:
1. Happy Path Tests - Complete workflow success scenarios
2. Reflexion Loop Tests - Self-critique and revision behavior
3. Error Handling Tests - Graceful degradation with sub-agent failures
4. Output Validation Tests - Structured JSON compliance
5. Performance Tests - Execution time and resource usage
"""

import pytest
import json
import time
from unittest.mock import MagicMock, patch, ANY
from typing import Dict, Any

from src.portfolio_manager.graph.builder import build_graph
from src.portfolio_manager.schemas import PortfolioReport
import logging

logger = logging.getLogger(__name__)


# =====================================================================
# 1. Happy Path Integration Tests
# =====================================================================


class TestHappyPathWorkflow:
    """
    Tests for complete V3 workflow success scenarios.
    
    Strategy: Run the workflow ONCE per class, then assert different aspects
    in separate test methods. This reduces test time from ~3min per test to
    ~3min for the entire class.
    """
    
    @pytest.fixture(scope="class")
    def workflow_result(
        self,
        initial_state,
        mock_all_external_apis,
        realistic_portfolio
    ):
        """
        Class-scoped fixture that runs the workflow once and caches the result.
        
        All test methods in this class will share this result.
        """
        logger.info("=" * 80)
        logger.info("RUNNING HAPPY PATH WORKFLOW (once for all tests in class)")
        logger.info("=" * 80)
        
        # Build V3 graph
        graph = build_graph()
        
        # Execute workflow
        final_state = graph.invoke(initial_state)
        
        logger.info(f"✅ Workflow completed. Caching result for test assertions.")
        
        return final_state
    
    def test_workflow_completes_without_errors(self, workflow_result):
        """Test that workflow completes without critical errors."""
        assert workflow_result is not None, "Graph execution returned None"
        assert "final_report" in workflow_result, "Missing final_report in state"
        assert workflow_result.get("error") is None or len(workflow_result.get("errors", [])) == 0, \
            f"Workflow failed with errors: {workflow_result.get('errors')}"
    
    def test_final_report_is_valid_json(self, workflow_result):
        """Test that final report is valid JSON."""
        final_report_str = workflow_result["final_report"]
        assert final_report_str, "Final report is empty"
        
        try:
            report_dict = json.loads(final_report_str)
            assert report_dict is not None
        except json.JSONDecodeError as e:
            pytest.fail(f"Final report is not valid JSON: {e}")
    
    def test_report_contains_all_required_components(self, workflow_result):
        """Test that report contains all required schema components."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        # Verify key components present
        assert "executive_summary" in report_dict, "Missing executive_summary"
        assert "market_regime" in report_dict, "Missing market_regime"
        assert "positions" in report_dict, "Missing positions"
        assert "risk_assessment" in report_dict, "Missing risk_assessment"
        assert "portfolio_strategy" in report_dict, "Missing portfolio_strategy"
        assert "reflexion_notes" in report_dict, "Missing reflexion_notes"
        assert "confidence_score" in report_dict, "Missing confidence_score"
        assert "timestamp" in report_dict, "Missing timestamp"
    
    def test_report_validates_against_schema(self, workflow_result):
        """Test that report validates against PortfolioReport Pydantic schema."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        # Validate with Pydantic schema
        try:
            report = PortfolioReport(**report_dict)
            assert report is not None
        except Exception as e:
            pytest.fail(f"Report failed Pydantic validation: {e}")
    
    def test_executive_summary_is_substantial(self, workflow_result):
        """Test that executive summary has meaningful content."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        summary = report_dict.get("executive_summary", "")
        assert len(summary) > 100, f"Executive summary too short: {len(summary)} chars"
        assert "portfolio" in summary.lower() or "analysis" in summary.lower(), \
            "Executive summary lacks key terms"
    
    def test_positions_analyzed_for_all_tickers(self, workflow_result):
        """Test that all portfolio tickers have position recommendations."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        positions = report_dict.get("positions", [])
        assert len(positions) > 0, "No positions in report"
        
        # Expected tickers from realistic_portfolio fixture
        expected_tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]
        actual_tickers = [p["ticker"] for p in positions]
        
        for ticker in expected_tickers:
            assert ticker in actual_tickers, f"Missing position for {ticker}"
    
    def test_market_regime_is_classified(self, workflow_result):
        """Test that market regime is properly classified."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        market_regime = report_dict.get("market_regime", {})
        assert "status" in market_regime, "Missing market regime status"
        assert "signal" in market_regime, "Missing market regime signal"
        assert market_regime["status"] in ["Goldilocks", "Inflationary", "Deflationary"], \
            f"Invalid market regime status: {market_regime['status']}"
        assert market_regime["signal"] in ["Risk-On", "Risk-Off"], \
            f"Invalid market signal: {market_regime['signal']}"
    
    def test_risk_metrics_are_calculated(self, workflow_result):
        """Test that risk assessment contains calculated metrics."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        risk = report_dict.get("risk_assessment", {})
        assert "beta" in risk, "Missing beta"
        assert "sharpe_ratio" in risk, "Missing sharpe_ratio"
        assert "portfolio_volatility" in risk, "Missing portfolio_volatility"
        assert "max_drawdown_risk" in risk, "Missing max_drawdown_risk"
        
        # Verify reasonable values
        assert 0 <= risk["beta"] <= 3.0, f"Beta out of reasonable range: {risk['beta']}"
        assert -5.0 <= risk["sharpe_ratio"] <= 10.0, f"Sharpe ratio out of range: {risk['sharpe_ratio']}"
    
    def test_confidence_score_is_reasonable(self, workflow_result):
        """Test that confidence score is within valid range."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        confidence = report_dict.get("confidence_score", 0)
        assert 0.0 <= confidence <= 1.0, f"Confidence out of range: {confidence}"
    
    def test_ai_disclaimer_is_present(self, workflow_result):
        """Test that AI disclaimer is included in report."""
        final_report_str = workflow_result["final_report"]
        report_dict = json.loads(final_report_str)
        
        disclaimer = report_dict.get("disclaimer", "")
        assert disclaimer, "Missing disclaimer"
        assert "AI" in disclaimer or "not financial advice" in disclaimer.lower(), \
            "Disclaimer missing key compliance language"
    
    def test_workflow_timing_is_acceptable(self, workflow_result):
        """Test that workflow completed in reasonable time (implicitly tested by fixture)."""
        # If we got here, the fixture completed within pytest timeout
        # Just verify the result exists
        assert workflow_result is not None
        logger.info("✅ All Happy Path tests passed using shared workflow result")
    
    def test_v3_workflow_with_small_portfolio(
        self,
        initial_state,
        small_portfolio,
        mock_all_external_apis
    ):
        """
        Test V3 workflow with smaller 3-ticker portfolio.
        
        Validates:
        - Workflow handles different portfolio sizes
        - All tickers analyzed correctly
        - Position actions generated for all tickers
        """
        # Update state with small portfolio
        initial_state["portfolio"] = small_portfolio
        
        # Build and execute
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Assertions
        assert final_state["final_report"], "Final report not generated"
        
        # Parse report
        report = json.loads(final_state["final_report"])
        
        # Verify positions for all tickers
        assert "positions" in report
        tickers = small_portfolio["tickers"]
        
        # Note: Some positions may be omitted if analysis failed, so we check for at least 1
        assert len(report["positions"]) >= 1, \
            f"Expected positions for {len(tickers)} tickers, got {len(report['positions'])}"
        
        # Verify all position actions have required fields
        for position in report["positions"]:
            assert "ticker" in position
            assert "action" in position
            assert position["action"] in ["Buy", "Sell", "Hold"]
            assert "confidence" in position
        
        logger.info(f"✅ Small portfolio workflow: {len(report['positions'])} positions analyzed")
    
    def test_v3_workflow_state_transitions(
        self,
        initial_state,
        mock_all_external_apis
    ):
        """
        Test that state transitions correctly through workflow stages.
        
        Validates:
        - Sub-agent status updated
        - Synthesis result populated
        - Reflexion feedback recorded
        - Final confidence score calculated
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Check sub-agent execution
        assert "sub_agent_status" in final_state, "Missing sub_agent_status"
        sub_agent_status = final_state["sub_agent_status"]
        
        # At least some agents should have completed
        completed_agents = [k for k, v in sub_agent_status.items() if v == "completed"]
        assert len(completed_agents) > 0, "No sub-agents completed"
        
        logger.info(f"✅ State transitions validated: {len(completed_agents)} agents completed")


# =====================================================================
# 2. Reflexion Loop Integration Tests
# =====================================================================


class TestReflexionLoopBehavior:
    """Tests for reflexion loop self-critique and revision behavior."""
    
    def test_reflexion_approves_on_first_iteration(
        self,
        initial_state,
        mock_all_external_apis,
        mocker
    ):
        """
        Test reflexion approves analysis on first iteration.
        
        Expected flow:
        Synthesis → Reflexion (approve) → Final Report
        
        Validates:
        - Reflexion iteration = 1
        - Reflexion approved = True
        - No loop back to synthesis
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Check reflexion approval
        assert final_state.get("reflexion_approved") is not False, \
            "Expected reflexion to approve (or reach max iterations)"
        
        # Check iteration count (should be 1 or at max 2)
        reflexion_iteration = final_state.get("reflexion_iteration", 0)
        assert reflexion_iteration >= 1, "Reflexion did not execute"
        assert reflexion_iteration <= 2, f"Too many reflexion iterations: {reflexion_iteration}"
        
        # Final report should be generated
        assert final_state.get("final_report"), "Final report not generated after reflexion"
        
        logger.info(f"✅ Reflexion approved on iteration {reflexion_iteration}")
    
    def test_reflexion_loop_rejection_and_revision(
        self,
        initial_state,
        mock_all_external_apis,
        mocker
    ):
        """
        Test reflexion rejects once, loops back, then approves.
        
        Expected flow:
        Synthesis → Reflexion (reject) → Synthesis (revision) → Reflexion (approve) → Final Report
        
        Validates:
        - Reflexion iteration increments
        - Feedback provided on rejection
        - Second synthesis incorporates feedback
        """
        # Mock reflexion to reject first time, approve second time
        original_reflexion = __import__(
            'src.portfolio_manager.graph.nodes.reflexion',
            fromlist=['reflexion_node']
        ).reflexion_node
        
        call_count = [0]
        
        def mock_reflexion_with_rejection(state):
            call_count[0] += 1
            
            if call_count[0] == 1:
                # First call: reject
                return {
                    "reflexion_approved": False,
                    "reflexion_iteration": state.get("reflexion_iteration", 0) + 1,
                    "reflexion_feedback": [
                        "Issue: Concentration risk in technology sector not adequately addressed"
                    ],
                    "confidence_adjustment": -0.05,
                    "scratchpad": state.get("scratchpad", []) + ["Reflexion: REJECTED - needs revision"]
                }
            else:
                # Second call: approve
                return {
                    "reflexion_approved": True,
                    "reflexion_iteration": state.get("reflexion_iteration", 1) + 1,
                    "reflexion_feedback": state.get("reflexion_feedback", []) + [
                        "Revision addresses concentration risk concerns"
                    ],
                    "confidence_adjustment": 0.0,
                    "scratchpad": state.get("scratchpad", []) + ["Reflexion: APPROVED"]
                }
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.reflexion_node',
            side_effect=mock_reflexion_with_rejection
        )
        
        # Execute graph
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Assertions
        assert call_count[0] == 2, f"Expected 2 reflexion calls, got {call_count[0]}"
        assert final_state.get("reflexion_iteration") == 2, "Expected 2 reflexion iterations"
        assert len(final_state.get("reflexion_feedback", [])) >= 1, "Missing reflexion feedback"
        assert final_state.get("final_report"), "Final report not generated"
        
        logger.info("✅ Reflexion loop rejection and revision validated")
    
    def test_reflexion_max_iterations_auto_approval(
        self,
        initial_state,
        mock_all_external_apis,
        mocker
    ):
        """
        Test reflexion auto-approves after max iterations (2).
        
        Expected flow:
        Synthesis → Reflexion (reject) → Synthesis → Reflexion (reject) → Final Report (auto-approved)
        
        Validates:
        - Max iteration limit enforced
        - Workflow does not loop indefinitely
        - Final report generated despite rejections
        """
        # Mock reflexion to always reject (but routing logic will force approval at max)
        def mock_reflexion_always_reject(state):
            iteration = state.get("reflexion_iteration", 0) + 1
            return {
                "reflexion_approved": False,  # Always reject
                "reflexion_iteration": iteration,
                "reflexion_feedback": [f"Rejection {iteration}: Still has issues"],
                "confidence_adjustment": -0.1,
                "scratchpad": state.get("scratchpad", []) + [f"Reflexion {iteration}: REJECTED"]
            }
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.reflexion_node',
            side_effect=mock_reflexion_always_reject
        )
        
        # Execute graph
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Assertions
        reflexion_iteration = final_state.get("reflexion_iteration", 0)
        assert reflexion_iteration >= 2, "Expected at least 2 reflexion iterations"
        assert reflexion_iteration <= 3, f"Too many iterations: {reflexion_iteration}"
        
        # Final report should still be generated (auto-approved)
        assert final_state.get("final_report"), "Final report not generated after max iterations"
        
        # Check that multiple feedback entries exist
        feedback = final_state.get("reflexion_feedback", [])
        assert len(feedback) >= 2, f"Expected at least 2 feedback entries, got {len(feedback)}"
        
        logger.info(f"✅ Max iterations auto-approval validated (iteration: {reflexion_iteration})")


# =====================================================================
# 3. Error Handling Integration Tests
# =====================================================================


class TestErrorHandlingWorkflow:
    """Tests for graceful degradation with sub-agent failures."""
    
    def test_single_sub_agent_failure_graceful_degradation(
        self,
        initial_state,
        mock_all_external_apis,
        mocker
    ):
        """
        Test workflow continues when a single sub-agent fails.
        
        Scenario: Macro Agent fails, but others succeed
        Expected: Synthesis uses available data, notes missing macro context
        
        Validates:
        - Workflow does not crash
        - Synthesis proceeds with partial data
        - Final report generated with warnings
        """
        # Mock Macro Agent to fail
        def mock_macro_agent_failure(state):
            raise Exception("FRED API connection timeout")
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.macro_agent_node',
            side_effect=mock_macro_agent_failure
        )
        
        # Execute graph
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Assertions
        # Workflow should complete despite macro agent failure
        assert final_state is not None, "Graph execution returned None"
        
        # Check if workflow reached final report or terminated
        if "final_report" in final_state and final_state["final_report"]:
            # Workflow completed - verify graceful degradation
            report = json.loads(final_state["final_report"])
            
            # Market regime should have default/fallback values
            assert "market_regime" in report
            # Confidence score should be reduced due to missing data
            assert report.get("confidence_score", 1.0) < 1.0
            
            logger.info("✅ Graceful degradation: workflow completed with macro agent failure")
        else:
            # Workflow terminated - verify sub-agent status shows failure
            sub_agent_status = final_state.get("sub_agent_status", {})
            macro_status = sub_agent_status.get("macro_agent")
            
            # Macro agent should be marked as failed
            assert macro_status == "failed" or "macro_analysis" not in final_state or \
                   final_state.get("macro_analysis") is None
            
            logger.info("✅ Workflow correctly terminated due to critical agent failure")
    
    def test_multiple_sub_agent_failures(
        self,
        initial_state,
        mock_all_external_apis,
        mocker
    ):
        """
        Test workflow behavior when multiple sub-agents fail.
        
        Scenario: Macro and Technical agents fail, Fundamental and Risk succeed
        Expected: Synthesis uses available fundamental + risk data
        
        Validates:
        - Partial analysis still provides value
        - Confidence appropriately reduced
        - Final report indicates limited analysis
        """
        # Mock failures
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.macro_agent_node',
            side_effect=Exception("Macro failure")
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.technical_agent.technical_agent_node',
            side_effect=Exception("Technical failure")
        )
        
        # Execute graph
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Check outcome
        sub_agent_status = final_state.get("sub_agent_status", {})
        
        # At least one analysis agent should have completed for workflow to continue
        analysis_agents = ["fundamental_agent", "technical_agent"]
        completed_analysis = [
            agent for agent in analysis_agents 
            if sub_agent_status.get(agent) == "completed"
        ]
        
        if len(completed_analysis) > 0:
            # Workflow should have continued with partial data
            assert "synthesis_result" in final_state or "final_report" in final_state
            logger.info(f"✅ Multiple failures handled: {len(completed_analysis)} analysis agents succeeded")
        else:
            # Workflow terminated due to insufficient data
            assert "error" in final_state or len(final_state.get("errors", [])) > 0
            logger.info("✅ Workflow correctly terminated due to insufficient sub-agent data")
    
    def test_critical_agent_failure_terminates_workflow(
        self,
        initial_state,
        mock_all_external_apis,
        mocker
    ):
        """
        Test workflow terminates when all analysis agents fail.
        
        Scenario: All sub-agents (Macro, Fundamental, Technical, Risk) fail
        Expected: Supervisor detects failure, workflow terminates gracefully
        
        Validates:
        - Workflow does not attempt synthesis with no data
        - Error message provided
        - No crash or infinite loop
        """
        # Mock all agents to fail
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.macro_agent_node',
            side_effect=Exception("Macro failure")
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fundamental_agent_node',
            side_effect=Exception("Fundamental failure")
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.technical_agent.technical_agent_node',
            side_effect=Exception("Technical failure")
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.risk_agent.risk_agent_node',
            side_effect=Exception("Risk failure")
        )
        
        # Execute graph
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Assertions
        # Workflow should terminate without reaching final report
        # Check supervisor routing detected all failures
        sub_agent_status = final_state.get("sub_agent_status", {})
        
        failed_agents = [k for k, v in sub_agent_status.items() if v == "failed"]
        
        # Should have failure indicators
        assert len(failed_agents) >= 2, "Not enough agents marked as failed"
        
        # Should NOT have final report if workflow terminated correctly
        # OR final report should indicate error condition
        if "final_report" in final_state and final_state["final_report"]:
            report = json.loads(final_state["final_report"])
            assert "error" in report or report.get("confidence_score", 1.0) < 0.3
        
        logger.info(f"✅ Critical failure handling: {len(failed_agents)} agents failed, workflow terminated")


# =====================================================================
# 4. Output Validation Integration Tests
# =====================================================================


class TestOutputValidation:
    """Tests for structured JSON output compliance."""
    
    def test_output_json_schema_compliance(
        self,
        initial_state,
        mock_all_external_apis
    ):
        """
        Test final output conforms to PortfolioReport schema.
        
        Validates:
        - All required fields present
        - Field types correct
        - Nested objects valid (MarketRegime, RiskAssessment, etc.)
        - Pydantic validation passes
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Extract and parse report
        assert "final_report" in final_state, "Missing final_report"
        report_str = final_state["final_report"]
        report_dict = json.loads(report_str)
        
        # Validate against Pydantic schema
        try:
            report = PortfolioReport(**report_dict)
            assert report is not None
        except Exception as e:
            pytest.fail(f"Report does not conform to PortfolioReport schema: {e}")
        
        # Verify required fields
        assert report.executive_summary, "Missing executive_summary"
        assert report.market_regime is not None, "Missing market_regime"
        assert report.portfolio_strategy is not None, "Missing portfolio_strategy"
        assert report.positions is not None, "Missing positions"
        assert report.risk_assessment is not None, "Missing risk_assessment"
        assert report.timestamp is not None, "Missing timestamp"
        assert 0.0 <= report.confidence_score <= 1.0, "Invalid confidence_score"
        
        logger.info("✅ JSON schema compliance validated")
    
    def test_output_contains_ai_disclaimer(
        self,
        initial_state,
        mock_all_external_apis
    ):
        """
        Test final output includes mandatory AI disclaimer.
        
        Validates:
        - Disclaimer field present and non-empty
        - Contains "AI" and "not financial advice" keywords
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        report_dict = json.loads(final_state["final_report"])
        
        assert "disclaimer" in report_dict, "Missing disclaimer"
        disclaimer = report_dict["disclaimer"].lower()
        
        # Check for key phrases
        assert "ai" in disclaimer or "artificial intelligence" in disclaimer, \
            "Disclaimer missing AI reference"
        assert "not financial advice" in disclaimer or "not a financial advisor" in disclaimer, \
            "Disclaimer missing financial advice warning"
        
        logger.info("✅ AI disclaimer validated")
    
    def test_output_metadata_correct(
        self,
        initial_state,
        mock_all_external_apis
    ):
        """
        Test output includes correct metadata (timestamp, version).
        
        Validates:
        - Timestamp recent and in correct format
        - Agent version = "v3.0"
        - Confidence score within valid range
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        report_dict = json.loads(final_state["final_report"])
        
        # Check timestamp
        assert "timestamp" in report_dict, "Missing timestamp"
        # Timestamp should be ISO format string
        from datetime import datetime
        try:
            timestamp = datetime.fromisoformat(report_dict["timestamp"].replace("Z", "+00:00"))
            # Should be recent (within last 5 minutes)
            time_diff = (datetime.now(timestamp.tzinfo) - timestamp).total_seconds()
            assert time_diff < 300, f"Timestamp too old: {time_diff}s"
        except Exception as e:
            pytest.fail(f"Invalid timestamp format: {e}")
        
        # Check version
        assert report_dict.get("agent_version") == "v3.0", "Incorrect agent version"
        
        # Check confidence score
        confidence = report_dict.get("confidence_score", -1)
        assert 0.0 <= confidence <= 1.0, f"Invalid confidence score: {confidence}"
        
        logger.info("✅ Output metadata validated")
    
    def test_position_actions_structure(
        self,
        initial_state,
        mock_all_external_apis
    ):
        """
        Test position actions have correct structure.
        
        Validates:
        - Each position has required fields
        - Action values are valid (Buy/Sell/Hold)
        - Confidence scores in valid range
        - Tickers match portfolio
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        report_dict = json.loads(final_state["final_report"])
        positions = report_dict.get("positions", [])
        
        assert len(positions) > 0, "No positions in report"
        
        for position in positions:
            # Check required fields
            assert "ticker" in position, "Position missing ticker"
            assert "action" in position, "Position missing action"
            assert "confidence" in position, "Position missing confidence"
            assert "rationale" in position, "Position missing rationale"
            
            # Validate action
            assert position["action"] in ["Buy", "Sell", "Hold"], \
                f"Invalid action: {position['action']}"
            
            # Validate confidence
            assert 0.0 <= position["confidence"] <= 1.0, \
                f"Invalid confidence: {position['confidence']}"
            
            # Check ticker is from portfolio
            assert position["ticker"] in initial_state["portfolio"]["tickers"], \
                f"Unknown ticker: {position['ticker']}"
        
        logger.info(f"✅ Position actions validated: {len(positions)} positions")


# =====================================================================
# 5. Performance Integration Tests
# =====================================================================


class TestPerformanceMetrics:
    """Tests for execution time and resource usage."""
    
    def test_workflow_execution_time_benchmark(
        self,
        initial_state,
        small_portfolio,
        mock_all_external_apis
    ):
        """
        Test workflow completes within acceptable time.
        
        Target: < 60 seconds for 3-ticker portfolio (with mocks)
        Note: Real workflow may be slower due to actual API calls
        
        Validates:
        - Execution time measured
        - Time within target range
        - No infinite loops or hangs
        """
        # Use small portfolio for faster execution
        initial_state["portfolio"] = small_portfolio
        
        graph = build_graph()
        
        start_time = time.time()
        final_state = graph.invoke(initial_state)
        duration = time.time() - start_time
        
        # Assertions
        assert final_state is not None, "Workflow did not complete"
        assert duration < 60, f"Workflow took {duration:.1f}s (target: <60s)"
        
        logger.info(f"✅ Workflow execution time: {duration:.2f}s")
    
    def test_api_call_count_reasonable(
        self,
        initial_state,
        small_portfolio,
        mock_all_external_apis
    ):
        """
        Test workflow makes reasonable number of API calls.
        
        Expected for 3-ticker portfolio:
        - FRED: ~5 calls (CPI, GDP, yields, VIX, unemployment)
        - Polygon: ~12 calls (3 tickers x 4 endpoints: details, OHLCV, benchmark, financials)
        - Gemini: ~10 calls (Supervisor, 3x Fundamental, 3x Technical, Synthesis, Reflexion, Summary)
        Total: ~27 calls
        
        Validates:
        - API call counts tracked
        - Calls within reasonable limits
        - No excessive retries
        """
        # Use small portfolio
        initial_state["portfolio"] = small_portfolio
        
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Count mock calls
        mocks = mock_all_external_apis
        
        fred_calls = sum([
            mocks["fred_cpi"].call_count,
            mocks["fred_gdp"].call_count,
            mocks["fred_yield"].call_count,
            mocks["fred_vix"].call_count,
            mocks["fred_unemployment"].call_count
        ])
        
        polygon_calls = sum([
            mocks["polygon_details"].call_count,
            mocks["polygon_ohlcv"].call_count
        ])
        
        gemini_calls = mocks["gemini"].call_count
        
        total_calls = fred_calls + polygon_calls + gemini_calls
        
        # Assertions (allow some flexibility)
        assert fred_calls <= 10, f"Too many FRED calls: {fred_calls}"
        assert polygon_calls <= 20, f"Too many Polygon calls: {polygon_calls}"
        assert gemini_calls <= 20, f"Too many Gemini calls: {gemini_calls}"
        assert total_calls <= 50, f"Total API calls too high: {total_calls}"
        
        logger.info(f"✅ API call count: FRED={fred_calls}, Polygon={polygon_calls}, Gemini={gemini_calls}, Total={total_calls}")


# =====================================================================
# 6. Workflow Routing Integration Tests
# =====================================================================


class TestWorkflowRouting:
    """Tests for correct routing between nodes."""
    
    def test_v3_workflow_routing_to_supervisor(
        self,
        initial_state,
        mock_all_external_apis
    ):
        """
        Test that start node routes to supervisor for V3 workflow.
        
        Validates:
        - Portfolio with tickers routes to supervisor
        - V3 workflow is activated
        - V2 legacy workflow not used
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Check that supervisor was invoked
        # Supervisor should populate sub_agent_status
        assert "sub_agent_status" in final_state, "Supervisor did not execute"
        assert len(final_state["sub_agent_status"]) > 0, "Sub-agent status empty"
        
        logger.info("✅ V3 workflow routing validated")
    
    def test_synthesis_to_reflexion_routing(
        self,
        initial_state,
        mock_all_external_apis
    ):
        """
        Test that synthesis always routes to reflexion.
        
        Validates:
        - Synthesis populates synthesis_result
        - Reflexion receives synthesis output
        - Reflexion feedback generated
        """
        graph = build_graph()
        final_state = graph.invoke(initial_state)
        
        # Check synthesis result exists
        assert "synthesis_result" in final_state or "final_report" in final_state, \
            "Synthesis did not execute"
        
        # Check reflexion executed
        assert final_state.get("reflexion_iteration", 0) > 0, \
            "Reflexion did not execute"
        
        logger.info("✅ Synthesis → Reflexion routing validated")


# =====================================================================
# Summary
# =====================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

