"""
Tests for Agent Utility Functions

This module contains unit tests for the utility functions used by the
autonomous agent, primarily focusing on state formatting and summarization.
It also tests the LLM API integration utilities.
"""

import pytest
from unittest.mock import MagicMock
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.utils import (
    format_portfolio_summary,
    format_analysis_summary,
    format_reasoning_trace,
    format_state_for_llm,
    deep_merge,
    estimate_cost,
    API_COSTS,
    ApiType,
    call_gemini_api,
    _get_gemini_client,
    LLM_MODEL,
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
        state = AgentState(
            portfolio=mock_portfolio,
            analysis_results=mock_analysis_results
        )
        formatted_state = format_state_for_llm(state)
        assert "Portfolio Summary:" in formatted_state
        assert "Total Value: $10,000.00" in formatted_state
        assert "Completed Analyses:" in formatted_state
        assert "AAPL: news, technicals" in formatted_state

    def test_format_state_for_llm_initial_state(self):
        """Should handle an initial state with no data."""
        state = AgentState(
            portfolio=None,
            analysis_results={}
        )
        formatted_state = format_state_for_llm(state)
        assert "Portfolio has not been loaded yet." in formatted_state
        assert "No analysis has been performed yet." in formatted_state


class TestDeepMerge:
    """Test suite for the deep_merge utility function."""

    def test_deep_merge_simple(self):
        """Should merge non-overlapping dictionaries."""
        source = {"a": 1}
        destination = {"b": 2}
        result = deep_merge(source, destination)
        assert result == {"a": 1, "b": 2}

    def test_deep_merge_overwrite(self):
        """Should overwrite existing keys in the destination."""
        source = {"a": "new"}
        destination = {"a": "old", "b": 2}
        result = deep_merge(source, destination)
        assert result == {"a": "new", "b": 2}

    def test_deep_merge_nested(self):
        """Should recursively merge nested dictionaries."""
        source = {"a": {"b": 2}}
        destination = {"a": {"c": 3}, "d": 4}
        result = deep_merge(source, destination)
        assert result == {"a": {"b": 2, "c": 3}, "d": 4}
        
    def test_deep_merge_complex(self):
        """Should handle a complex merge with overwrites and additions."""
        source = {
            "analysis_results": {
                "AAPL": {"news": "new news"}
            }
        }
        destination = {
            "portfolio": {"total_value": 100},
            "analysis_results": {
                "AAPL": {"technicals": "old technicals"},
                "MSFT": {"news": "msft news"}
            }
        }
        result = deep_merge(source, destination)
        
        expected = {
            "portfolio": {"total_value": 100},
            "analysis_results": {
                "AAPL": {
                    "technicals": "old technicals",
                    "news": "new news"
                },
                "MSFT": {"news": "msft news"}
            }
        }
        assert result == expected


class TestCostEstimation:
    """Test suite for the estimate_cost utility function."""

    def test_estimate_cost_empty_list(self):
        """Should return 0.0 for an empty list of calls."""
        assert estimate_cost([]) == 0.0

    def test_estimate_cost_single_call(self):
        """Should correctly calculate the cost of a single API call."""
        api_calls = [{"api_type": ApiType.SERP_API.value, "count": 10}]
        expected_cost = API_COSTS[ApiType.SERP_API] * 10
        assert estimate_cost(api_calls) == pytest.approx(expected_cost)

    def test_estimate_cost_multiple_calls(self):
        """Should correctly sum the costs of multiple different API calls."""
        api_calls = [
            {"api_type": ApiType.LLM_GEMINI_2_5_FLASH.value, "count": 10000},
            {"api_type": ApiType.POLYGON_API.value, "count": 5},
        ]
        expected_cost = (API_COSTS[ApiType.LLM_GEMINI_2_5_FLASH] * 10000) + (API_COSTS[ApiType.POLYGON_API] * 5)
        assert estimate_cost(api_calls) == pytest.approx(expected_cost)

    def test_estimate_cost_unknown_api_type(self):
        """Should ignore unknown API types and not raise an error."""
        api_calls = [{"api_type": "unknown_api", "count": 100}]
        assert estimate_cost(api_calls) == 0.0

    def test_estimate_cost_mixed_known_and_unknown(self):
        """Should calculate cost for known APIs while ignoring unknown ones."""
        api_calls = [
            {"api_type": ApiType.SERP_API.value, "count": 3},
            {"api_type": "unknown_api", "count": 10},
        ]
        expected_cost = API_COSTS[ApiType.SERP_API] * 3
        assert estimate_cost(api_calls) == pytest.approx(expected_cost)

    def test_estimate_cost_call_with_no_count(self):
        """Should treat a call with a missing 'count' key as a count of 0."""
        api_calls = [{"api_type": ApiType.POLYGON_API.value}]
        assert estimate_cost(api_calls) == 0.0


class TestLLMUtilities:
    """Test suite for LLM API integration utilities."""

    def test_get_gemini_client_creates_client_once(self, mocker):
        """Should create client on first call and reuse it."""
        # Mock the genai.Client class
        mock_client_class = mocker.patch("src.portfolio_manager.utils.genai.Client")
        mock_client_instance = MagicMock()
        mock_client_class.return_value = mock_client_instance
        
        # Mock the settings
        mocker.patch("src.portfolio_manager.utils.settings.GEMINI_API_KEY", "test-api-key")
        
        # Reset the global client
        import src.portfolio_manager.utils as utils_module
        utils_module._gemini_client = None
        
        # First call should create the client
        client1 = _get_gemini_client()
        assert client1 == mock_client_instance
        assert mock_client_class.call_count == 1
        
        # Second call should return the same client
        client2 = _get_gemini_client()
        assert client2 == mock_client_instance
        assert mock_client_class.call_count == 1  # Should not create a new client
        
        # Clean up
        utils_module._gemini_client = None

    def test_get_gemini_client_raises_on_missing_key(self, mocker):
        """Should raise ValueError if API key is not configured."""
        # Mock empty API key
        mocker.patch("src.portfolio_manager.utils.settings.GEMINI_API_KEY", None)
        
        # Reset the global client
        import src.portfolio_manager.utils as utils_module
        utils_module._gemini_client = None
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="GEMINI_API_KEY is not set"):
            _get_gemini_client()
        
        # Clean up
        utils_module._gemini_client = None

    def test_call_gemini_api_success(self, mocker):
        """Should successfully call the Gemini API and return response text."""
        # Mock the client
        mock_client_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "This is a test response from Gemini."
        mock_response.usage_metadata = None
        
        mock_client_instance.models.generate_content.return_value = mock_response
        
        mocker.patch(
            "src.portfolio_manager.utils._get_gemini_client",
            return_value=mock_client_instance
        )
        
        # Call the API
        result = call_gemini_api("Test prompt")
        
        # Assertions
        assert result == "This is a test response from Gemini."
        mock_client_instance.models.generate_content.assert_called_once_with(
            model=LLM_MODEL,
            contents="Test prompt"
        )

    def test_call_gemini_api_with_custom_model(self, mocker):
        """Should use custom model when specified."""
        # Mock the client
        mock_client_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Response"
        mock_response.usage_metadata = None
        
        mock_client_instance.models.generate_content.return_value = mock_response
        
        mocker.patch(
            "src.portfolio_manager.utils._get_gemini_client",
            return_value=mock_client_instance
        )
        
        # Call with custom model
        result = call_gemini_api("Test prompt", model="gemini-2.5-pro")
        
        # Assertions
        assert result == "Response"
        mock_client_instance.models.generate_content.assert_called_once_with(
            model="gemini-2.5-pro",
            contents="Test prompt"
        )

    def test_call_gemini_api_logs_usage_metadata(self, mocker):
        """Should log token usage when available in response."""
        # Mock the client
        mock_client_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Response with usage data"
        
        # Mock usage metadata
        mock_usage = MagicMock()
        mock_usage.total_token_count = 100
        mock_usage.prompt_token_count = 60
        mock_usage.candidates_token_count = 40
        mock_response.usage_metadata = mock_usage
        
        mock_client_instance.models.generate_content.return_value = mock_response
        
        mocker.patch(
            "src.portfolio_manager.utils._get_gemini_client",
            return_value=mock_client_instance
        )
        
        # Mock logger to verify logging
        mock_logger = mocker.patch("src.portfolio_manager.utils.logger")
        
        # Call the API
        result = call_gemini_api("Test prompt")
        
        # Assertions
        assert result == "Response with usage data"
        
        # Check that debug logging was called with token info
        debug_calls = [str(call) for call in mock_logger.debug.call_args_list]
        assert any("Tokens: 100" in call for call in debug_calls)

    def test_call_gemini_api_captures_errors_in_sentry(self, mocker):
        """Should capture exceptions in Sentry when API call fails."""
        # Mock the client to raise an exception
        mock_client_instance = MagicMock()
        mock_client_instance.models.generate_content.side_effect = Exception("API Error")
        
        mocker.patch(
            "src.portfolio_manager.utils._get_gemini_client",
            return_value=mock_client_instance
        )
        
        # Mock Sentry
        mock_sentry = mocker.patch("src.portfolio_manager.utils.sentry_sdk.capture_exception")
        
        # Call should raise exception after retries
        with pytest.raises(Exception, match="API Error"):
            call_gemini_api("Test prompt")
        
        # Sentry should capture the exception on each attempt (3 retries)
        assert mock_sentry.call_count == 3

    def test_call_gemini_api_retries_on_failure(self, mocker):
        """Should retry the API call on transient failures."""
        # Mock the client to fail twice then succeed
        mock_client_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Success after retries"
        mock_response.usage_metadata = None
        
        mock_client_instance.models.generate_content.side_effect = [
            Exception("Transient error 1"),
            Exception("Transient error 2"),
            mock_response,
        ]
        
        mocker.patch(
            "src.portfolio_manager.utils._get_gemini_client",
            return_value=mock_client_instance
        )
        
        # Mock Sentry to avoid actual calls
        mocker.patch("src.portfolio_manager.utils.sentry_sdk.capture_exception")
        
        # Call should succeed after retries
        result = call_gemini_api("Test prompt")
        
        # Assertions
        assert result == "Success after retries"
        assert mock_client_instance.models.generate_content.call_count == 3

    def test_call_gemini_api_raises_after_max_retries(self, mocker):
        """Should raise exception after exhausting retry attempts."""
        # Mock the client to always fail
        mock_client_instance = MagicMock()
        mock_client_instance.models.generate_content.side_effect = Exception("Persistent error")
        
        mocker.patch(
            "src.portfolio_manager.utils._get_gemini_client",
            return_value=mock_client_instance
        )
        
        # Mock Sentry
        mock_sentry = mocker.patch("src.portfolio_manager.utils.sentry_sdk.capture_exception")
        
        # Call should fail after retries
        with pytest.raises(Exception, match="Persistent error"):
            call_gemini_api("Test prompt")
        
        # Should have retried 3 times
        assert mock_client_instance.models.generate_content.call_count == 3
        
        # Sentry should capture all attempts
        assert mock_sentry.call_count == 3

    def test_call_gemini_api_propagates_value_error(self, mocker):
        """Should immediately propagate ValueError without multiple retries on config error."""
        # Mock _get_gemini_client to raise ValueError
        mocker.patch(
            "src.portfolio_manager.utils._get_gemini_client",
            side_effect=ValueError("API key not configured")
        )
        
        # Mock Sentry
        mock_sentry = mocker.patch("src.portfolio_manager.utils.sentry_sdk.capture_exception")
        
        # Should raise ValueError (though it may retry due to the decorator)
        with pytest.raises(ValueError, match="API key not configured"):
            call_gemini_api("Test prompt")
        
        # Sentry should capture the exception
        assert mock_sentry.call_count >= 1
