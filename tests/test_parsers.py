"""
Tests for LLM Response Parsers

This module contains unit tests for the parsing functions that handle
the raw output from the language model, ensuring it can be reliably
converted into a structured agent decision.
"""

import pytest
from unittest.mock import patch

from src.portfolio_manager.parsers import parse_agent_decision


@patch('src.portfolio_manager.parsers.list_tools', return_value=['parse_portfolio', 'analyze_news'])
class TestParseAgentDecision:
    """Test suite for the parse_agent_decision function."""

    def test_parse_valid_json_string(self, mock_list_tools):
        """Should parse a clean, valid JSON string."""
        response = '{"reasoning": "Test", "action": "parse_portfolio", "arguments": {}}'
        decision = parse_agent_decision(response)
        assert decision["action"] == "parse_portfolio"
        assert decision["reasoning"] == "Test"
        assert decision["arguments"] == {}

    def test_parse_json_in_markdown_block(self, mock_list_tools):
        """Should parse JSON wrapped in a markdown code block."""
        response = 'Some text before ```json\n{"reasoning": "Test", "action": "analyze_news", "arguments": {"tickers": ["AAPL"]}}\n```'
        decision = parse_agent_decision(response)
        assert decision["action"] == "analyze_news"
        assert decision["arguments"] == {"tickers": ["AAPL"]}

    def test_parse_json_in_markdown_block_no_language(self, mock_list_tools):
        """Should parse JSON wrapped in a markdown code block without the 'json' tag."""
        response = 'Here is the action: ```\n{"reasoning": "Test", "action": "parse_portfolio", "arguments": {}}\n```'
        decision = parse_agent_decision(response)
        assert decision["action"] == "parse_portfolio"

    def test_parse_json_with_surrounding_text(self, mock_list_tools):
        """Should find and parse JSON even with extra text outside of markdown."""
        response = 'Sure, here is the next step: {"reasoning": "Test", "action": "parse_portfolio", "arguments": {}}. Let me know what to do next.'
        decision = parse_agent_decision(response)
        assert decision["action"] == "parse_portfolio"

    def test_parse_missing_optional_fields(self, mock_list_tools):
        """Should handle missing 'reasoning' and 'arguments' fields by providing defaults."""
        response = '{"action": "parse_portfolio"}'
        decision = parse_agent_decision(response)
        assert decision["action"] == "parse_portfolio"
        assert decision["reasoning"] == ""
        assert decision["arguments"] == {}

    def test_parse_valid_generate_report_action(self, mock_list_tools):
        """Should correctly parse the special 'generate_report' action."""
        response = '{"reasoning": "Finished analysis", "action": "generate_report"}'
        decision = parse_agent_decision(response)
        assert decision["action"] == "generate_report"

    def test_parse_invalid_json_raises_value_error(self, mock_list_tools):
        """Should raise ValueError for malformed JSON."""
        response = '{"reasoning": "Test", "action": "parse_portfolio", "arguments": {"a":1,}}'  # Extra comma makes it invalid
        with pytest.raises(ValueError, match="Failed to decode JSON"):
            parse_agent_decision(response)

    def test_parse_no_json_raises_value_error(self, mock_list_tools):
        """Should raise ValueError if no JSON object is found."""
        response = "There is no action I can take here."
        with pytest.raises(ValueError, match="No valid JSON object found"):
            parse_agent_decision(response)

    def test_parse_missing_action_field_raises_value_error(self, mock_list_tools):
        """Should raise ValueError if the 'action' field is missing."""
        response = '{"reasoning": "Test", "arguments": {}}'
        with pytest.raises(ValueError, match="The 'action' field is missing"):
            parse_agent_decision(response)

    def test_parse_unknown_action_raises_value_error(self, mock_list_tools):
        """Should raise ValueError for an unknown tool name."""
        response = '{"reasoning": "Test", "action": "unknown_tool", "arguments": {}}'
        with pytest.raises(ValueError, match="Unknown action 'unknown_tool'"):
            parse_agent_decision(response)
            
    def test_parse_complex_nested_json(self, mock_list_tools):
        """Should correctly parse a JSON object with nested structures."""
        response = '''
        Here is my decision:
        ```json
        {
            "reasoning": "Analyzing news for a high-priority stock.",
            "action": "analyze_news",
            "arguments": {
                "tickers": ["MSFT"],
                "options": {
                    "limit": 10,
                    "provider": "NewYorkTimes"
                }
            }
        }
        ```
        '''
        decision = parse_agent_decision(response)
        assert decision["action"] == "analyze_news"
        assert decision["arguments"]["tickers"] == ["MSFT"]
        assert decision["arguments"]["options"]["limit"] == 10
