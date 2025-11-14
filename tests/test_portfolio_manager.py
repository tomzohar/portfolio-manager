import pytest
from unittest.mock import patch, MagicMock
from stock_researcher.agents.portfolio_manager import generate_portfolio_recommendations
from stock_researcher.agents.portfolio_parser import Portfolio, PortfolioPosition

@pytest.fixture
def mock_portfolio():
    """Fixture for a mock portfolio."""
    positions = [
        PortfolioPosition('AAPL', 150.0, 10, 1500.0, 50.0),
        PortfolioPosition('GOOG', 2800.0, 0.5, 1400.0, 46.67),
        PortfolioPosition('TSLA', 700.0, 0.14, 100.0, 3.33)
    ]
    return Portfolio(positions, 3000.0)

@pytest.fixture
def mock_summaries():
    """Fixture for mock news summaries."""
    return {
        'AAPL': 'Positive news about new product launch.',
        'GOOG': 'Neutral news about regulatory updates.',
        'TSLA': 'Negative news about production delays.'
    }

@patch('stock_researcher.agents.portfolio_manager.call_gemini_api')
def test_generate_portfolio_recommendations_success(mock_call_gemini, mock_portfolio, mock_summaries):
    """
    Test successful generation of portfolio recommendations.
    """
    # Arrange
    mock_response_text = """
    {
        "portfolio_summary": "The portfolio is well-balanced, but TSLA poses a risk.",
        "recommendations": [
            {
                "ticker": "TSLA",
                "recommendation": "DECREASE",
                "reasoning": "Negative news about production delays."
            }
        ]
    }
    """
    mock_call_gemini.return_value = mock_response_text

    # Act
    recommendations = generate_portfolio_recommendations(mock_portfolio, mock_summaries, {})

    # Assert
    assert recommendations['portfolio_summary'] == "The portfolio is well-balanced, but TSLA poses a risk."
    assert len(recommendations['recommendations']) == 1
    assert recommendations['recommendations'][0]['ticker'] == 'TSLA'
    
    # Verify that the LLM was called with the correct data
    mock_call_gemini.assert_called_once()
    prompt_contents = mock_call_gemini.call_args[0][0]
    assert '"ticker": "AAPL"' in prompt_contents
    assert 'Negative news about production delays.' in prompt_contents

@patch('stock_researcher.agents.portfolio_manager.call_gemini_api')
def test_generate_portfolio_recommendations_api_error(mock_call_gemini, mock_portfolio, mock_summaries):
    """
    Test handling of an API error during recommendation generation.
    """
    # Arrange
    mock_call_gemini.side_effect = Exception("API Failure")

    # Act
    recommendations = generate_portfolio_recommendations(mock_portfolio, mock_summaries, {})

    # Assert
    assert recommendations['portfolio_summary'] == "Failed to generate recommendations due to an API error."
    assert len(recommendations['recommendations']) == 0
