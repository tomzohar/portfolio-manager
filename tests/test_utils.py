"""
Tests for Agent Utility Functions

This module contains unit tests for the utility functions used by the
autonomous agent, primarily focusing on state formatting and summarization.
"""

import pytest
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.utils import (
    format_portfolio_summary,
    format_analysis_summary,
    format_reasoning_trace,
    format_state_for_llm,
)


@pytest.fixture
def mock_portfolio():
    """Provides a mock portfolio dictionary for testing."""
    return {
        "total_value": 10000.00,
        "positions": [
            {
                "ticker": "AAPL",
                "market_value": 5000.00,
                "percentage_of_portfolio": 0.50,
            },
            {
                "ticker": "GOOG",
                "market_value": 3000.00,
                "percentage_of_portfolio": 0.30,
            },
            {
                "ticker": "MSFT",
                "market_value": 2000.00,
                "percentage_of_portfolio": 0.20,
            },
        ],
    }


@pytest.fixture
def mock_analysis_results():
    """Provides mock analysis results for testing."""
    return {
        "AAPL": {"news": {"sentiment": 0.8}, "technicals": {"rsi": 65}},
        "GOOG": {"news": {"sentiment": -0.2}},
    }


class TestFormattingUtils:
    """Test suite for the state formatting utility functions."""

    # Tests for format_portfolio_summary
    def test_format_portfolio_summary_with_data(self, mock_portfolio):
        """Should format a portfolio with positions correctly."""
        summary = format_portfolio_summary(mock_portfolio)
        assert "Portfolio Summary:" in summary
        assert "Total Value: $10,000.00" in summary
        assert "Total Positions: 3" in summary
        assert "AAPL: $5,000.00 (50.00%)" in summary
        assert "GOOG: $3,000.00 (30.00%)" in summary

    def test_format_portfolio_summary_empty(self):
        """Should return a specific message for an empty portfolio."""
        summary = format_portfolio_summary({})
        assert summary == "Portfolio has not been loaded yet."

    def test_format_portfolio_summary_none(self):
        """Should return a specific message for a None portfolio."""
        summary = format_portfolio_summary(None)
        assert summary == "Portfolio has not been loaded yet."
        
    def test_format_portfolio_summary_no_positions(self):
        """Should handle a portfolio dictionary with no 'positions' key."""
        portfolio = {"total_value": 100}
        summary = format_portfolio_summary(portfolio)
        assert "Total Positions: 0" in summary
        assert "Top 5 Positions:" in summary

    # Tests for format_analysis_summary
    def test_format_analysis_summary_with_data(self, mock_analysis_results):
        """Should format analysis results correctly."""
        summary = format_analysis_summary(mock_analysis_results)
        assert "Completed Analyses:" in summary
        assert "AAPL: news, technicals" in summary
        assert "GOOG: news" in summary
        assert "MSFT" not in summary

    def test_format_analysis_summary_empty(self):
        """Should return a specific message for empty analysis results."""
        summary = format_analysis_summary({})
        assert summary == "No analysis has been performed yet."

    # Tests for format_reasoning_trace
    def test_format_reasoning_trace_with_data(self):
        """Should format a reasoning trace correctly."""
        trace = ["Step 1", "Step 2", "Step 3"]
        formatted_trace = format_reasoning_trace(trace)
        assert "Previous Actions:" in formatted_trace
        assert "- Step 1" in formatted_trace
        assert "- Step 3" in formatted_trace

    def test_format_reasoning_trace_empty(self):
        """Should return a specific message for an empty trace."""
        formatted_trace = format_reasoning_trace([])
        assert formatted_trace == "No actions taken yet."

    def test_format_reasoning_trace_truncates(self):
        """Should show only the last 5 steps if the trace is long."""
        trace = [f"Step {i}" for i in range(10)]
        formatted_trace = format_reasoning_trace(trace)
        assert "- Step 4" not in formatted_trace
        assert "- Step 5" in formatted_trace
        assert "- Step 9" in formatted_trace

    # Tests for format_state_for_llm
    def test_format_state_for_llm_full_state(self, mock_portfolio, mock_analysis_results):
        """Should combine portfolio and analysis summaries."""
        state: AgentState = {
            "portfolio": mock_portfolio,
            "analysis_results": mock_analysis_results,
            # Other state fields are not used by this function
        }
        formatted_state = format_state_for_llm(state)
        assert "Portfolio Summary:" in formatted_state
        assert "Total Value: $10,000.00" in formatted_state
        assert "Completed Analyses:" in formatted_state
        assert "AAPL: news, technicals" in formatted_state

    def test_format_state_for_llm_initial_state(self):
        """Should handle an initial state with no data."""
        state: AgentState = {
            "portfolio": None,
            "analysis_results": {},
        }
        formatted_state = format_state_for_llm(state)
        assert "Portfolio has not been loaded yet." in formatted_state
        assert "No analysis has been performed yet." in formatted_state
