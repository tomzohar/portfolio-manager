"""
Tests for Macro Agent Node

Tests the macroeconomic analysis node with mocked FRED API and LLM calls.
"""

import pytest
from unittest.mock import patch, MagicMock
from src.portfolio_manager.graph.nodes.macro_agent import (
    macro_agent_node,
    _fetch_macro_indicators,
    _build_macro_analysis_prompt,
    _parse_market_regime
)
from src.portfolio_manager.schemas import MarketRegime


@pytest.fixture
def mock_fred_data_inflationary():
    """Mock FRED data indicating inflationary regime."""
    return {
        "available": True,
        "cpi_yoy": 4.5,
        "gdp_growth": 2.1,
        "yield_spread": -0.3,  # Inverted
        "vix": 22.0,
        "unemployment": 4.2,
        "date": "2024-11-22"
    }


@pytest.fixture
def mock_fred_data_deflationary():
    """Mock FRED data indicating deflationary regime."""
    return {
        "available": True,
        "cpi_yoy": 1.2,
        "gdp_growth": -1.5,
        "yield_spread": 0.8,
        "vix": 28.0,
        "unemployment": 7.5,
        "date": "2024-11-22"
    }


@pytest.fixture
def mock_fred_data_goldilocks():
    """Mock FRED data indicating goldilocks regime."""
    return {
        "available": True,
        "cpi_yoy": 2.3,
        "gdp_growth": 2.8,
        "yield_spread": 0.5,
        "vix": 14.0,
        "unemployment": 3.8,
        "date": "2024-11-22"
    }


@pytest.fixture
def initial_state():
    """Initial agent state with minimal data."""
    return {
        "scratchpad": [],
        "portfolio": {"tickers": ["AAPL", "MSFT"]},
        "reasoning_trace": []
    }


class TestMacroAgentNode:
    """Tests for the macro_agent_node function."""

    def test_inflationary_regime_detection(self, initial_state, mock_fred_data_inflationary, mocker):
        """Test Macro Agent correctly identifies inflationary regime."""
        # Mock FRED functions
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent._fetch_macro_indicators',
            return_value=mock_fred_data_inflationary
        )
        
        # Mock LLM response using the centralized utility
        mock_llm_response = '''{"status": "Inflationary", "signal": "Risk-Off", "key_driver": "High CPI + inverted yield curve", "confidence": 0.85}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = macro_agent_node(initial_state)
        
        # Assert
        assert result["macro_analysis"] is not None
        assert result["macro_analysis"]["status"] == "Inflationary"
        assert result["macro_analysis"]["signal"] == "Risk-Off"
        assert "Macro Agent" in result["scratchpad"][0]

    def test_deflationary_regime_detection(self, initial_state, mock_fred_data_deflationary, mocker):
        """Test Macro Agent correctly identifies deflationary regime."""
        # Mock FRED functions
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent._fetch_macro_indicators',
            return_value=mock_fred_data_deflationary
        )
        
        # Mock LLM response
        mock_llm_response = '''{"status": "Deflationary", "signal": "Risk-Off", "key_driver": "Negative GDP growth + high VIX", "confidence": 0.9}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = macro_agent_node(initial_state)
        
        # Assert
        assert result["macro_analysis"] is not None
        assert result["macro_analysis"]["status"] == "Deflationary"
        assert result["macro_analysis"]["signal"] == "Risk-Off"

    def test_goldilocks_regime_detection(self, initial_state, mock_fred_data_goldilocks, mocker):
        """Test Macro Agent correctly identifies goldilocks regime."""
        # Mock FRED functions
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent._fetch_macro_indicators',
            return_value=mock_fred_data_goldilocks
        )
        
        # Mock LLM response
        mock_llm_response = '''{"status": "Goldilocks", "signal": "Risk-On", "key_driver": "Moderate growth + low inflation", "confidence": 0.88}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = macro_agent_node(initial_state)
        
        # Assert
        assert result["macro_analysis"] is not None
        assert result["macro_analysis"]["status"] == "Goldilocks"
        assert result["macro_analysis"]["signal"] == "Risk-On"

    def test_fred_api_failure_handling(self, initial_state, mocker):
        """Test graceful handling of FRED API failures."""
        # Mock FRED failure
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent._fetch_macro_indicators',
            return_value={"available": False}
        )
        
        # Execute
        result = macro_agent_node(initial_state)
        
        # Assert graceful degradation
        assert result["macro_analysis"] is None
        assert "unavailable" in result["scratchpad"][0].lower()

    def test_llm_parsing_error_handling(self, initial_state, mock_fred_data_goldilocks, mocker):
        """Test handling of invalid LLM JSON response."""
        # Mock FRED functions
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent._fetch_macro_indicators',
            return_value=mock_fred_data_goldilocks
        )
        
        # Mock invalid LLM response
        mock_llm_response = "This is not valid JSON at all!"
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = macro_agent_node(initial_state)
        
        # Assert fallback regime used
        assert result["macro_analysis"] is not None
        assert result["macro_analysis"]["confidence"] < 0.5  # Low confidence fallback
        assert result["macro_analysis"]["status"] == "Goldilocks"

    def test_state_integration(self, initial_state, mock_fred_data_goldilocks, mocker):
        """Test that macro_analysis and scratchpad are correctly updated in state."""
        # Mock FRED functions
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent._fetch_macro_indicators',
            return_value=mock_fred_data_goldilocks
        )
        
        # Mock LLM response
        mock_llm_response = '''{"status": "Goldilocks", "signal": "Risk-On", "key_driver": "Test", "confidence": 0.8}'''
        
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.call_gemini_api',
            return_value=mock_llm_response
        )
        
        # Execute
        result = macro_agent_node(initial_state)
        
        # Assert state updates
        assert "macro_analysis" in result
        assert "scratchpad" in result
        assert len(result["scratchpad"]) == 1
        assert "Market regime" in result["scratchpad"][0]


class TestFetchMacroIndicators:
    """Tests for _fetch_macro_indicators helper function."""

    def test_successful_fetch(self, mocker):
        """Test successful fetching of all economic indicators."""
        # Mock all FRED functions
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_latest_cpi_yoy',
            return_value=3.5
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_latest_gdp_growth',
            return_value=2.2
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_yield_curve_spread',
            return_value=0.3
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_vix',
            return_value=18.5
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_unemployment_rate',
            return_value=4.0
        )
        
        # Execute
        result = _fetch_macro_indicators()
        
        # Assert
        assert result["available"] is True
        assert result["cpi_yoy"] == 3.5
        assert result["gdp_growth"] == 2.2
        assert result["yield_spread"] == 0.3
        assert result["vix"] == 18.5
        assert result["unemployment"] == 4.0

    def test_missing_critical_indicators(self, mocker):
        """Test handling when critical indicators are missing."""
        # Mock CPI returning None
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_latest_cpi_yoy',
            return_value=None
        )
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_latest_gdp_growth',
            return_value=2.2
        )
        
        # Execute
        result = _fetch_macro_indicators()
        
        # Assert
        assert result["available"] is False

    def test_exception_handling(self, mocker):
        """Test exception handling in indicator fetching."""
        # Mock function raising exception
        mocker.patch(
            'src.portfolio_manager.graph.nodes.macro_agent.get_latest_cpi_yoy',
            side_effect=Exception("API Error")
        )
        
        # Execute
        result = _fetch_macro_indicators()
        
        # Assert graceful degradation
        assert result["available"] is False


class TestBuildMacroAnalysisPrompt:
    """Tests for _build_macro_analysis_prompt helper function."""

    def test_prompt_contains_all_indicators(self, mock_fred_data_goldilocks):
        """Test that prompt includes all economic indicators."""
        prompt = _build_macro_analysis_prompt(mock_fred_data_goldilocks)
        
        # Assert all indicators present
        assert str(mock_fred_data_goldilocks["cpi_yoy"]) in prompt
        assert str(mock_fred_data_goldilocks["gdp_growth"]) in prompt
        assert str(mock_fred_data_goldilocks["yield_spread"]) in prompt
        assert str(mock_fred_data_goldilocks["vix"]) in prompt
        assert str(mock_fred_data_goldilocks["unemployment"]) in prompt

    def test_prompt_includes_system_instructions(self, mock_fred_data_goldilocks):
        """Test that prompt includes proper system instructions."""
        prompt = _build_macro_analysis_prompt(mock_fred_data_goldilocks)
        
        # Assert system prompt elements
        assert "Inflationary" in prompt
        assert "Deflationary" in prompt
        assert "Goldilocks" in prompt
        assert "Risk-On" in prompt
        assert "Risk-Off" in prompt
        assert "JSON" in prompt


class TestParseMarketRegime:
    """Tests for _parse_market_regime helper function."""

    def test_parse_valid_json(self):
        """Test parsing valid JSON response."""
        response = '{"status": "Goldilocks", "signal": "Risk-On", "key_driver": "Test driver", "confidence": 0.85}'
        
        regime = _parse_market_regime(response)
        
        assert isinstance(regime, MarketRegime)
        assert regime.status == "Goldilocks"
        assert regime.signal == "Risk-On"
        assert regime.key_driver == "Test driver"
        assert regime.confidence == 0.85

    def test_parse_json_with_markdown(self):
        """Test parsing JSON wrapped in markdown code blocks."""
        response = '''```json
{"status": "Inflationary", "signal": "Risk-Off", "key_driver": "High inflation", "confidence": 0.9}
```'''
        
        regime = _parse_market_regime(response)
        
        assert isinstance(regime, MarketRegime)
        assert regime.status == "Inflationary"
        assert regime.signal == "Risk-Off"

    def test_parse_invalid_json_fallback(self):
        """Test fallback behavior with invalid JSON."""
        response = "This is not JSON"
        
        regime = _parse_market_regime(response)
        
        # Should return conservative fallback
        assert isinstance(regime, MarketRegime)
        assert regime.confidence < 0.5

    def test_parse_missing_confidence_field(self):
        """Test parsing when confidence field is missing (should default)."""
        response = '{"status": "Goldilocks", "signal": "Risk-On", "key_driver": "Test"}'
        
        regime = _parse_market_regime(response)
        
        assert isinstance(regime, MarketRegime)
        assert 0.0 <= regime.confidence <= 1.0

    def test_parse_invalid_enum_values(self):
        """Test handling of invalid enum values."""
        response = '{"status": "InvalidStatus", "signal": "Risk-On", "key_driver": "Test", "confidence": 0.8}'
        
        # Should fallback gracefully rather than raising
        regime = _parse_market_regime(response)
        
        # Should return conservative fallback
        assert isinstance(regime, MarketRegime)
        assert regime.confidence < 0.5  # Fallback has low confidence

