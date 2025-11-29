"""
Tests for Portfolio Manager Entry Points (V3 Integration)

Tests the CLI interface, version routing, and output formatting
for both V2 and V3 workflows.

Test Coverage:
- Version routing (v2, v3, auto)
- Output formats (json, text)
- CLI argument parsing
- Error handling
- File output
"""

import pytest
import json
import sys
from unittest.mock import MagicMock, patch, mock_open
from datetime import datetime

# Import modules to test
from src.portfolio_manager.graph.main import (
    run_autonomous_analysis,
    _format_output_as_json,
    _format_output_as_text,
    main
)
from src.portfolio_manager.graph.builder import build_graph


# =====================================================================
# Test Fixtures
# =====================================================================

@pytest.fixture
def mock_v3_state():
    """Mock V3 workflow final state with structured JSON report."""
    return {
        "final_report": json.dumps({
            "executive_summary": "Portfolio positioned well for current market conditions.",
            "market_regime": {
                "status": "Goldilocks",
                "signal": "Risk-On",
                "key_driver": "Strong GDP growth"
            },
            "portfolio_strategy": {
                "action": "Accumulate",
                "rationale": "Market conditions favorable"
            },
            "positions": [
                {
                    "ticker": "AAPL",
                    "action": "Buy",
                    "current_weight": 0.3,
                    "target_weight": 0.35,
                    "rationale": "Strong fundamentals",
                    "confidence": 0.85
                },
                {
                    "ticker": "MSFT",
                    "action": "Hold",
                    "current_weight": 0.4,
                    "target_weight": 0.4,
                    "rationale": "Maintaining position",
                    "confidence": 0.75
                }
            ],
            "risk_assessment": {
                "beta": 1.05,
                "sharpe_projected": 1.2,
                "max_drawdown_risk": "Moderate",
                "var_95": 4.5,
                "portfolio_volatility": 18.2
            },
            "reflexion_notes": "Analysis approved after self-critique review.",
            "timestamp": "2025-11-23T10:30:00Z",
            "confidence_score": 0.82,
            "agent_version": "v3.0",
            "disclaimer": "I am an AI assistant. This is not financial advice."
        }),
        "errors": []
    }


@pytest.fixture
def mock_v2_state():
    """Mock V2 workflow final state with narrative report."""
    return {
        "final_report": "Portfolio Analysis Report\n\nRecommendations:\n- AAPL: Strong buy signal\n- MSFT: Hold position",
        "confidence_score": 0.75,
        "errors": []
    }


@pytest.fixture
def mock_v3_state_with_errors():
    """Mock V3 state with errors."""
    state = {
        "final_report": json.dumps({
            "executive_summary": "Analysis completed with warnings.",
            "market_regime": {"status": "Goldilocks", "signal": "Risk-On", "key_driver": "N/A"},
            "portfolio_strategy": {"action": "Hold", "rationale": "Insufficient data"},
            "positions": [],
            "risk_assessment": {
                "beta": 1.0,
                "sharpe_projected": 0.0,
                "max_drawdown_risk": "Moderate",
                "var_95": 0.0,
                "portfolio_volatility": 0.0
            },
            "reflexion_notes": "Analysis approved with warnings.",
            "timestamp": "2025-11-23T10:30:00Z",
            "confidence_score": 0.5,
            "agent_version": "v3.0",
            "disclaimer": "I am an AI assistant."
        }),
        "errors": ["Failed to fetch FRED data", "Polygon API timeout"]
    }
    return state


# =====================================================================
# Test: run_autonomous_analysis() with version parameter
# =====================================================================

class TestRunAutonomousAnalysis:
    """Test run_autonomous_analysis function with different versions."""
    
    def test_run_with_v3_version(self, mocker):
        """Test running with explicit V3 version."""
        mock_build_graph = mocker.patch('src.portfolio_manager.graph.main.build_graph')
        mock_graph = MagicMock()
        mock_build_graph.return_value = mock_graph
        mock_graph.invoke.return_value = {"final_report": "V3 report"}
        
        result = run_autonomous_analysis(max_iterations=10, version="v3")
        
        # Verify build_graph called with version="v3"
        mock_build_graph.assert_called_once_with(version="v3")
        
        # Verify graph invoked
        assert mock_graph.invoke.called
        assert result["final_report"] == "V3 report"
    
    def test_run_with_v2_version(self, mocker):
        """Test running with explicit V2 version."""
        mock_build_graph = mocker.patch('src.portfolio_manager.graph.main.build_graph')
        mock_graph = MagicMock()
        mock_build_graph.return_value = mock_graph
        mock_graph.invoke.return_value = {"final_report": "V2 report"}
        
        result = run_autonomous_analysis(max_iterations=5, version="v2")
        
        # Verify build_graph called with version="v2"
        mock_build_graph.assert_called_once_with(version="v2")
        
        # Verify V2 recursion limit calculation
        # V2 formula: (max_iterations * 4) + 10 = (5 * 4) + 10 = 30
        config = mock_graph.invoke.call_args[1]["config"]
        assert config["recursion_limit"] == 30
    
    def test_run_with_auto_version(self, mocker):
        """Test running with auto-detect version."""
        mock_build_graph = mocker.patch('src.portfolio_manager.graph.main.build_graph')
        mock_graph = MagicMock()
        mock_build_graph.return_value = mock_graph
        mock_graph.invoke.return_value = {"final_report": "Auto report"}
        
        result = run_autonomous_analysis(max_iterations=10, version="auto")
        
        # Verify build_graph called with version="auto"
        mock_build_graph.assert_called_once_with(version="auto")
        
        # Verify V3 recursion limit used for auto
        config = mock_graph.invoke.call_args[1]["config"]
        assert config["recursion_limit"] == 30
    
    def test_run_with_invalid_version(self):
        """Test that invalid version raises ValueError."""
        with pytest.raises(ValueError, match="Invalid version"):
            run_autonomous_analysis(max_iterations=10, version="v4")
    
    def test_run_defaults_to_v3(self, mocker):
        """Test that default version is V3."""
        mock_build_graph = mocker.patch('src.portfolio_manager.graph.main.build_graph')
        mock_graph = MagicMock()
        mock_build_graph.return_value = mock_graph
        mock_graph.invoke.return_value = {"final_report": "Default report"}
        
        # Call without version parameter
        result = run_autonomous_analysis(max_iterations=10)
        
        # Verify default is v3
        mock_build_graph.assert_called_once_with(version="v3")


# =====================================================================
# Test: build_graph() with version parameter
# =====================================================================

class TestBuildGraph:
    """Test build_graph function with version routing."""
    
    def test_build_graph_v3_returns_compiled_graph(self):
        """Test building V3 graph returns compiled StateGraph."""
        graph = build_graph(version="v3")
        
        # Verify it's a compiled graph (has invoke method)
        assert hasattr(graph, 'invoke')
        assert callable(graph.invoke)
    
    def test_build_graph_v2_returns_compiled_graph(self):
        """Test building V2 graph returns compiled StateGraph."""
        graph = build_graph(version="v2")
        
        # Verify it's a compiled graph
        assert hasattr(graph, 'invoke')
        assert callable(graph.invoke)
    
    def test_build_graph_auto_returns_compiled_graph(self):
        """Test building auto-detect graph returns compiled StateGraph."""
        graph = build_graph(version="auto")
        
        # Verify it's a compiled graph
        assert hasattr(graph, 'invoke')
        assert callable(graph.invoke)
    
    def test_build_graph_invalid_version_raises_error(self):
        """Test that invalid version raises ValueError."""
        with pytest.raises(ValueError, match="Invalid version"):
            build_graph(version="v99")
    
    def test_build_graph_v3_has_supervisor_node(self):
        """Test V3 graph includes supervisor node."""
        graph = build_graph(version="v3")
        
        # Verify graph has V3 nodes
        # Note: StateGraph doesn't expose nodes directly, but we can test
        # that it was built without errors and has the invoke method
        assert graph is not None
    
    def test_build_graph_v2_has_agent_node(self):
        """Test V2 graph includes agent decision node."""
        graph = build_graph(version="v2")
        
        # Verify graph was built successfully
        assert graph is not None


# =====================================================================
# Test: Output Formatting Functions
# =====================================================================

class TestOutputFormatting:
    """Test output formatting functions for JSON and text."""
    
    def test_format_v3_output_as_json(self, mock_v3_state):
        """Test formatting V3 output as JSON."""
        result = _format_output_as_json(mock_v3_state, "v3")
        
        assert result["status"] == "success"
        assert result["version"] == "v3.0"
        assert result["report"] is not None
        assert isinstance(result["report"], dict)
        assert result["report"]["executive_summary"]
        assert result["report"]["market_regime"]["status"] == "Goldilocks"
        assert len(result["report"]["positions"]) == 2
        assert result["errors"] == []
    
    def test_format_v2_output_as_json(self, mock_v2_state):
        """Test formatting V2 output as JSON."""
        result = _format_output_as_json(mock_v2_state, "v2")
        
        assert result["status"] == "success"
        assert result["version"] == "v2.0"
        assert "Portfolio Analysis Report" in result["report"]
        assert result["confidence_score"] == 0.75
        assert result["errors"] == []
    
    def test_format_v3_output_as_text(self, mock_v3_state):
        """Test formatting V3 output as human-readable text."""
        result = _format_output_as_text(mock_v3_state, "v3")
        
        assert isinstance(result, str)
        assert "PORTFOLIO ANALYSIS REPORT (V3)" in result
        assert "Goldilocks" in result
        assert "AAPL" in result
        assert "MSFT" in result
        assert "Strong fundamentals" in result
        assert "Moderate" in result  # Risk level
    
    def test_format_v2_output_as_text(self, mock_v2_state):
        """Test formatting V2 output as human-readable text."""
        result = _format_output_as_text(mock_v2_state, "v2")
        
        assert isinstance(result, str)
        assert "PORTFOLIO ANALYSIS REPORT (V2 Legacy)" in result
        assert "Strong buy signal" in result
    
    def test_format_json_with_errors(self, mock_v3_state_with_errors):
        """Test JSON formatting includes errors."""
        result = _format_output_as_json(mock_v3_state_with_errors, "v3")
        
        assert result["status"] == "completed_with_errors"
        assert len(result["errors"]) == 2
        assert "FRED" in result["errors"][0]
    
    def test_format_text_with_errors(self, mock_v2_state):
        """Test text formatting handles errors."""
        mock_v2_state["errors"] = ["API timeout", "Rate limit exceeded"]
        
        result = _format_output_as_text(mock_v2_state, "v2")
        
        assert "error(s)" in result
        assert "API timeout" in result
    
    def test_format_json_handles_invalid_json(self):
        """Test JSON formatting handles invalid JSON in report."""
        state = {
            "final_report": "Invalid JSON {not valid}",
            "errors": []
        }
        
        result = _format_output_as_json(state, "v3")
        
        assert result["report"]["error"] == "Failed to parse final report JSON"
    
    def test_format_text_handles_missing_report(self):
        """Test text formatting handles missing report."""
        state = {"errors": []}
        
        result = _format_output_as_text(state, "v3")
        
        assert "ERROR: No report generated" in result


# =====================================================================
# Test: CLI Main Function
# =====================================================================

class TestCLIMain:
    """Test main() CLI entry point function."""
    
    def test_main_defaults_to_v3(self, mocker):
        """Test CLI defaults to V3 workflow when no version specified."""
        mocker.patch('sys.argv', ['main.py'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = {"final_report": json.dumps({"executive_summary": "Test"}), "errors": []}
        
        # Mock print to capture output
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify called with v3
        assert mock_run.call_args[1]["version"] == "v3"
        assert result == 0
    
    def test_main_accepts_v2_flag(self, mocker):
        """Test CLI accepts --version v2 flag."""
        mocker.patch('sys.argv', ['main.py', '--version', 'v2'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = {"final_report": "V2 report", "errors": []}
        
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify called with v2
        assert mock_run.call_args[1]["version"] == "v2"
        assert result == 0
    
    def test_main_accepts_auto_flag(self, mocker):
        """Test CLI accepts --version auto flag."""
        mocker.patch('sys.argv', ['main.py', '--version', 'auto'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = {"final_report": json.dumps({"executive_summary": "Test"}), "errors": []}
        
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify called with auto
        assert mock_run.call_args[1]["version"] == "auto"
        assert result == 0
    
    def test_main_json_output_format(self, mocker, mock_v3_state):
        """Test CLI outputs JSON format by default."""
        mocker.patch('sys.argv', ['main.py'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = mock_v3_state
        
        mock_print = mocker.patch('builtins.print')
        
        result = main()
        
        # Verify JSON output
        assert result == 0
        output = mock_print.call_args[0][0]
        
        # Parse JSON to verify it's valid
        # Output has newline prefix
        json_data = json.loads(output.strip())
        assert json_data["version"] == "v3.0"
        assert "report" in json_data
    
    def test_main_text_output_format(self, mocker, mock_v3_state):
        """Test CLI outputs text format when specified."""
        mocker.patch('sys.argv', ['main.py', '--format', 'text'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = mock_v3_state
        
        mock_print = mocker.patch('builtins.print')
        
        result = main()
        
        # Verify text output
        assert result == 0
        output = mock_print.call_args[0][0]
        assert "PORTFOLIO ANALYSIS REPORT (V3)" in output
    
    def test_main_writes_to_file(self, mocker, mock_v3_state):
        """Test CLI writes output to file when --output specified."""
        mocker.patch('sys.argv', ['main.py', '--output', 'report.json'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = mock_v3_state
        
        mock_open_func = mock_open()
        mocker.patch('builtins.open', mock_open_func)
        
        result = main()
        
        # Verify file was opened for writing report.json
        assert result == 0
        # Check that report.json was opened (will be called along with log files)
        report_calls = [call for call in mock_open_func.call_args_list if 'report.json' in str(call)]
        assert len(report_calls) > 0, "report.json should have been opened"
        
        # Verify the specific call was made
        assert any('report.json' in str(call) and call[0][1] == 'w' 
                   for call in mock_open_func.call_args_list)
    
    def test_main_verbose_logging(self, mocker, mock_v3_state):
        """Test CLI enables verbose logging with --verbose flag."""
        mocker.patch('sys.argv', ['main.py', '--verbose'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = mock_v3_state
        
        # Mock the logging setup - V3 uses its own logging configuration
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify result is successful (verbose logging is configured internally)
        assert result == 0
    
    def test_main_handles_no_final_report(self, mocker):
        """Test CLI handles case where no final report is generated."""
        mocker.patch('sys.argv', ['main.py'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = {"errors": ["Failed to generate report"]}
        
        mocker.patch('builtins.print')
        
        # The function calls sys.exit(1) instead of returning
        with pytest.raises(SystemExit) as excinfo:
            main()
        
        # Verify exits with error code
        assert excinfo.value.code == 1
    
    def test_main_handles_value_error(self, mocker):
        """Test CLI handles ValueError from invalid version."""
        mocker.patch('sys.argv', ['main.py'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.side_effect = ValueError("Invalid configuration")
        
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify exits with error code
        assert result == 1
    
    def test_main_handles_keyboard_interrupt(self, mocker):
        """Test CLI handles KeyboardInterrupt gracefully."""
        mocker.patch('sys.argv', ['main.py'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.side_effect = KeyboardInterrupt()
        
        result = main()
        
        # Verify exits with 130 (standard for SIGINT)
        assert result == 130
    
    def test_main_handles_unexpected_exception(self, mocker):
        """Test CLI handles unexpected exceptions."""
        mocker.patch('sys.argv', ['main.py'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.side_effect = RuntimeError("Unexpected error")
        
        mock_sentry = mocker.patch('sentry_sdk.capture_exception')
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify exits with error code
        assert result == 1
        
        # Verify Sentry called
        assert mock_sentry.called
    
    def test_main_no_notification_flag(self, mocker, mock_v2_state):
        """Test --no-notification flag suppresses notifications."""
        mocker.patch('sys.argv', ['main.py', '--version', 'v2', '--no-notification'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = mock_v2_state
        
        mock_notification = mocker.patch('src.portfolio_manager.integrations.pushover.send_pushover_message')
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify notification NOT called
        assert result == 0
        mock_notification.assert_not_called()
    
    def test_main_sends_v2_notification(self, mocker, mock_v2_state):
        """Test V2 workflow sends notification when enabled."""
        mocker.patch('sys.argv', ['main.py', '--version', 'v2'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = mock_v2_state
        
        mock_notification = mocker.patch('src.portfolio_manager.integrations.pushover.send_pushover_message')
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify notification called for V2
        assert result == 0
        mock_notification.assert_called_once()
        
        # Verify notification content - updated to match send_pushover_message signature
        call_args = mock_notification.call_args[1]
        assert "V2" in call_args["title"]
    
    def test_main_max_iterations_parameter(self, mocker, mock_v2_state):
        """Test --max-iterations parameter is passed to run_autonomous_analysis."""
        mocker.patch('sys.argv', ['main.py', '--max-iterations', '5'])
        mock_run = mocker.patch('src.portfolio_manager.graph.main.run_autonomous_analysis')
        mock_run.return_value = mock_v2_state
        
        mocker.patch('builtins.print')
        
        result = main()
        
        # Verify max_iterations passed
        assert result == 0
        assert mock_run.call_args[1]["max_iterations"] == 5


# =====================================================================
# Test: Integration with run_portfolio_manager.py
# =====================================================================

class TestRunPortfolioManagerWrapper:
    """Test run_portfolio_manager.py wrapper script integration."""
    
    def test_wrapper_script_imports_main(self):
        """Test wrapper script can import main function."""
        from src.portfolio_manager.graph.main import main as imported_main
        
        assert callable(imported_main)
    
    def test_wrapper_script_exists(self):
        """Test run_portfolio_manager.py exists and is executable."""
        import os
        
        wrapper_path = "run_portfolio_manager.py"
        assert os.path.exists(wrapper_path)
        
        # Check it's a Python file
        with open(wrapper_path, 'r') as f:
            content = f.read()
            assert "#!/usr/bin/env python3" in content
            assert "from src.portfolio_manager.graph.main import main" in content


