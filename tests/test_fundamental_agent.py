"""
Tests for Fundamental Agent Node

Tests the fundamental analysis node with mocked Polygon API and LLM calls.
"""

import pytest
from unittest.mock import patch, MagicMock
from src.portfolio_manager.graph.nodes.fundamental_agent import (
    fundamental_agent_node,
    _analyze_ticker_fundamentals,
    _compute_fundamental_metrics,
    _build_fundamental_prompt,
    _parse_fundamental_assessment
)


@pytest.fixture
def mock_ticker_details_apple():
    """Mock Polygon ticker details for AAPL."""
    return {
        "success": True,
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "market_cap": 3000000000000,
        "shares_outstanding": 16000000000,
        "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
        "sector": "Technology Hardware, Storage & Peripherals",
        "industry": "Technology Hardware, Storage & Peripherals",
        "exchange": "NASDAQ",
        "employees": 164000,
        "homepage_url": "https://www.apple.com"
    }


@pytest.fixture
def mock_financial_statements_success():
    """Mock successful financial statements response."""
    return {
        "success": True,
        "ticker": "AAPL",
        "count": 4,
        "statements": [
            {
                "period": "Q3",
                "fiscal_year": 2024,
                "fiscal_period": "Q3",
                "start_date": "2024-04-01",
                "end_date": "2024-06-30",
                "filing_date": "2024-07-31",
                "revenue": 90000000000,
                "net_income": 23000000000,
                "total_assets": 350000000000,
                "total_liabilities": 280000000000,
                "operating_cash_flow": 25000000000,
                "eps": 1.45,
                "gross_profit": 40000000000
            },
            {
                "period": "Q2",
                "fiscal_year": 2024,
                "fiscal_period": "Q2",
                "start_date": "2024-01-01",
                "end_date": "2024-03-31",
                "filing_date": "2024-04-30",
                "revenue": 85000000000,
                "net_income": 22000000000,
                "total_assets": 345000000000,
                "total_liabilities": 275000000000,
                "operating_cash_flow": 23000000000,
                "eps": 1.38,
                "gross_profit": 38000000000
            }
        ]
    }


@pytest.fixture
def mock_financial_statements_unavailable():
    """Mock unavailable financial statements (subscription tier limitation)."""
    return {
        "success": False,
        "ticker": "AAPL",
        "count": 0,
        "statements": [],
        "error": "No financial statements available (may be subscription tier limitation)"
    }


@pytest.fixture
def initial_state_multi_ticker():
    """Initial agent state with multiple tickers."""
    return {
        "portfolio": {"tickers": ["AAPL", "MSFT", "GOOGL"]},
        "scratchpad": []
    }


@pytest.fixture
def initial_state_single_ticker():
    """Initial agent state with single ticker."""
    return {
        "portfolio": {"tickers": ["AAPL"]},
        "scratchpad": []
    }


class TestFundamentalAgentNode:
    """Tests for the fundamental_agent_node function."""

    def test_multiple_tickers_processing(self, initial_state_multi_ticker, mock_ticker_details_apple, mock_financial_statements_success, mocker):
        """Test Fundamental Agent processes multiple tickers correctly."""
        # Mock Polygon API
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_ticker_details',
            return_value=mock_ticker_details_apple
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_financial_statements',
            return_value=mock_financial_statements_success
        )
        
        # Mock LLM response
        mock_llm_response = '''{"valuation": "Fair", "quality_score": 9, "recommendation": "Hold", "rationale": "Strong financials", "key_risks": ["Competition"], "confidence": 0.9}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = fundamental_agent_node(initial_state_multi_ticker)
        
        # Assert
        assert len(result["fundamental_analysis"]) == 3
        assert "AAPL" in result["fundamental_analysis"]
        assert "MSFT" in result["fundamental_analysis"]
        assert "GOOGL" in result["fundamental_analysis"]

    def test_undervalued_assessment(self, initial_state_single_ticker, mock_ticker_details_apple, mock_financial_statements_success, mocker):
        """Test handling of undervalued stock assessment."""
        # Mock Polygon API
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_ticker_details',
            return_value=mock_ticker_details_apple
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_financial_statements',
            return_value=mock_financial_statements_success
        )
        
        # Mock LLM response - undervalued
        mock_llm_response = '''{"valuation": "Undervalued", "quality_score": 9, "recommendation": "Buy", "rationale": "Trading below intrinsic value", "key_risks": ["Market volatility"], "confidence": 0.85}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = fundamental_agent_node(initial_state_single_ticker)
        
        # Assert
        assert result["fundamental_analysis"]["AAPL"]["success"] is True
        assert result["fundamental_analysis"]["AAPL"]["assessment"]["valuation"] == "Undervalued"
        assert result["fundamental_analysis"]["AAPL"]["assessment"]["recommendation"] == "Buy"

    def test_overvalued_assessment(self, initial_state_single_ticker, mock_ticker_details_apple, mock_financial_statements_success, mocker):
        """Test handling of overvalued stock assessment."""
        # Mock Polygon API
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_ticker_details',
            return_value=mock_ticker_details_apple
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_financial_statements',
            return_value=mock_financial_statements_success
        )
        
        # Mock LLM response - overvalued
        mock_llm_response = '''{"valuation": "Overvalued", "quality_score": 6, "recommendation": "Sell", "rationale": "Trading above fair value", "key_risks": ["Valuation risk", "Competition"], "confidence": 0.8}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = fundamental_agent_node(initial_state_single_ticker)
        
        # Assert
        assert result["fundamental_analysis"]["AAPL"]["assessment"]["valuation"] == "Overvalued"
        assert result["fundamental_analysis"]["AAPL"]["assessment"]["recommendation"] == "Sell"

    def test_missing_financial_data_handling(self, initial_state_single_ticker, mock_ticker_details_apple, mock_financial_statements_unavailable, mocker):
        """Test graceful handling when financial statements are unavailable."""
        # Mock Polygon API
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_ticker_details',
            return_value=mock_ticker_details_apple
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_financial_statements',
            return_value=mock_financial_statements_unavailable
        )
        
        # Mock LLM response - limited analysis
        mock_llm_response = '''{"valuation": "Fair", "quality_score": 5, "recommendation": "Hold", "rationale": "Limited data available", "key_risks": ["Data limitations"], "confidence": 0.4}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = fundamental_agent_node(initial_state_single_ticker)
        
        # Assert graceful degradation
        assert result["fundamental_analysis"]["AAPL"]["success"] is True
        assert result["fundamental_analysis"]["AAPL"]["statements_available"] is False
        assert result["fundamental_analysis"]["AAPL"]["assessment"]["confidence"] < 0.5

    def test_polygon_api_failure(self, initial_state_single_ticker, mocker):
        """Test error handling when Polygon API fails."""
        # Mock Polygon API failure
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_ticker_details',
            return_value={"success": False, "error": "API Error"}
        )
        
        # Execute
        result = fundamental_agent_node(initial_state_single_ticker)
        
        # Assert
        assert result["fundamental_analysis"]["AAPL"]["success"] is False
        assert "error" in result["fundamental_analysis"]["AAPL"]

    def test_empty_portfolio(self, mocker):
        """Test handling of empty portfolio."""
        state = {"portfolio": {"tickers": []}, "scratchpad": []}
        
        # Execute
        result = fundamental_agent_node(state)
        
        # Assert
        assert result["fundamental_analysis"] == {}
        assert "No tickers" in result["scratchpad"][0]

    def test_llm_parsing_error(self, initial_state_single_ticker, mock_ticker_details_apple, mock_financial_statements_success, mocker):
        """Test handling of invalid LLM JSON response."""
        # Mock Polygon API
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_ticker_details',
            return_value=mock_ticker_details_apple
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.fetch_financial_statements',
            return_value=mock_financial_statements_success
        )
        
        # Mock invalid LLM response
        mock_llm_response = "This is not valid JSON!"
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.fundamental_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = fundamental_agent_node(initial_state_single_ticker)
        
        # Assert fallback used
        assert result["fundamental_analysis"]["AAPL"]["success"] is True
        assert result["fundamental_analysis"]["AAPL"]["assessment"]["confidence"] < 0.5
        assert result["fundamental_analysis"]["AAPL"]["assessment"]["recommendation"] == "Hold"


class TestComputeFundamentalMetrics:
    """Tests for _compute_fundamental_metrics helper function."""

    def test_metrics_calculation_with_statements(self, mock_ticker_details_apple, mock_financial_statements_success):
        """Test metric computation with available financial statements."""
        metrics = _compute_fundamental_metrics(mock_ticker_details_apple, mock_financial_statements_success)
        
        # Assert metrics computed
        assert metrics["available"] is True
        assert "revenue_growth_qoq" in metrics
        assert "net_income_margin" in metrics
        assert "debt_to_assets" in metrics
        assert "ocf_trend" in metrics
        
        # Check calculations
        # Revenue growth: (90B - 85B) / 85B * 100 ≈ 5.88%
        assert abs(metrics["revenue_growth_qoq"] - 5.88) < 0.1
        
        # Net income margin: (23B / 90B) * 100 ≈ 25.56%
        assert abs(metrics["net_income_margin"] - 25.56) < 0.1
        
        # Debt-to-assets: (280B / 350B) * 100 = 80%
        assert abs(metrics["debt_to_assets"] - 80.0) < 0.1

    def test_metrics_with_missing_statements(self, mock_ticker_details_apple, mock_financial_statements_unavailable):
        """Test metric computation when statements unavailable."""
        metrics = _compute_fundamental_metrics(mock_ticker_details_apple, mock_financial_statements_unavailable)
        
        # Assert graceful fallback
        assert metrics["available"] is False
        assert "note" in metrics
        assert "market_cap" in metrics

    def test_metrics_with_null_values(self, mock_ticker_details_apple):
        """Test handling of null/missing values in statements."""
        statements = {
            "success": True,
            "statements": [
                {"revenue": None, "net_income": None},
                {"revenue": None, "net_income": None}
            ]
        }
        
        metrics = _compute_fundamental_metrics(mock_ticker_details_apple, statements)
        
        # Should handle None values gracefully
        assert metrics["available"] is True
        assert metrics.get("net_income_margin") is None


class TestBuildFundamentalPrompt:
    """Tests for _build_fundamental_prompt helper function."""

    def test_prompt_with_full_data(self, mock_ticker_details_apple, mock_financial_statements_success):
        """Test prompt construction with complete data."""
        metrics = _compute_fundamental_metrics(mock_ticker_details_apple, mock_financial_statements_success)
        prompt = _build_fundamental_prompt("AAPL", mock_ticker_details_apple, metrics, mock_financial_statements_success)
        
        # Assert all key elements present
        assert "AAPL" in prompt
        assert "Apple Inc." in prompt or "Technology" in prompt
        assert "Undervalued" in prompt  # System instructions
        assert "JSON" in prompt
        assert str(mock_ticker_details_apple["market_cap"]) in prompt or "3,000,000,000,000" in prompt

    def test_prompt_with_limited_data(self, mock_ticker_details_apple, mock_financial_statements_unavailable):
        """Test prompt construction when financials unavailable."""
        metrics = _compute_fundamental_metrics(mock_ticker_details_apple, mock_financial_statements_unavailable)
        prompt = _build_fundamental_prompt("AAPL", mock_ticker_details_apple, metrics, mock_financial_statements_unavailable)
        
        # Assert limited data message
        assert "not available" in prompt.lower()


class TestParseFundamentalAssessment:
    """Tests for _parse_fundamental_assessment helper function."""

    def test_parse_valid_json(self):
        """Test parsing valid JSON response."""
        response = '''{"valuation": "Undervalued", "quality_score": 9, "recommendation": "Buy", "rationale": "Strong growth", "key_risks": ["Competition"], "confidence": 0.85}'''
        
        assessment = _parse_fundamental_assessment(response)
        
        assert assessment["valuation"] == "Undervalued"
        assert assessment["quality_score"] == 9
        assert assessment["recommendation"] == "Buy"
        assert assessment["confidence"] == 0.85

    def test_parse_json_with_markdown(self):
        """Test parsing JSON wrapped in markdown."""
        response = '''```json
{"valuation": "Overvalued", "quality_score": 6, "recommendation": "Sell", "rationale": "High valuation", "key_risks": ["Risk1"], "confidence": 0.8}
```'''
        
        assessment = _parse_fundamental_assessment(response)
        
        assert assessment["valuation"] == "Overvalued"
        assert assessment["recommendation"] == "Sell"

    def test_parse_invalid_json_fallback(self):
        """Test fallback behavior with invalid JSON."""
        response = "This is not JSON"
        
        assessment = _parse_fundamental_assessment(response)
        
        # Should return conservative fallback
        assert assessment["recommendation"] == "Hold"
        assert assessment["confidence"] < 0.5

    def test_parse_missing_fields(self):
        """Test handling of missing optional fields."""
        response = '{"valuation": "Fair", "quality_score": 7, "recommendation": "Hold"}'
        
        assessment = _parse_fundamental_assessment(response)
        
        # Should have defaults
        assert assessment["rationale"] is not None
        assert assessment["confidence"] >= 0.0

