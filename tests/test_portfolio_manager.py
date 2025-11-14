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

@patch('stock_researcher.agents.portfolio_manager.client')
def test_generate_portfolio_recommendations_success(mock_gemini_client, mock_portfolio, mock_summaries):
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
                "reasoning": "Negative news about production delays.",
                "suggested_action": "Decrease position from 3.33% to 1%."
            }
        ]
    }
    """
    mock_response = MagicMock()
    mock_response.text = mock_response_text
    mock_gemini_client.models.generate_content.return_value = mock_response

    # Act
    recommendations = generate_portfolio_recommendations(mock_portfolio, mock_summaries)

    # Assert
    assert 'portfolio_summary' in recommendations
    assert 'recommendations' in recommendations
    assert recommendations['portfolio_summary'] == "The portfolio is well-balanced, but TSLA poses a risk."
    assert len(recommendations['recommendations']) == 1
    assert recommendations['recommendations'][0]['ticker'] == 'TSLA'
    
    # Verify that the LLM was called with the correct data structure
    mock_gemini_client.models.generate_content.assert_called_once()
    call_args = mock_gemini_client.models.generate_content.call_args
    prompt_contents = call_args.kwargs['contents']
    assert '"ticker": "AAPL"' in prompt_contents
    assert '"ticker": "TSLA"' in prompt_contents
    assert '"total_value": 3000.0' in prompt_contents
    assert 'Negative news about production delays.' in prompt_contents

@patch('stock_researcher.agents.portfolio_manager.client')
def test_generate_portfolio_recommendations_api_error(mock_gemini_client, mock_portfolio, mock_summaries):
    """
    Test handling of an API error during recommendation generation.
    """
    # Arrange
    mock_gemini_client.models.generate_content.side_effect = Exception("API Failure")

    # Act
    recommendations = generate_portfolio_recommendations(mock_portfolio, mock_summaries)

    # Assert
    assert recommendations['portfolio_summary'] == "Failed to generate recommendations due to an API error."
    assert len(recommendations['recommendations']) == 0

@patch('stock_researcher.agents.portfolio_manager.genai.Client')
def test_client_initialization_error(mock_gemini_client):
    """
    Test that an exception is raised if the Gemini client fails to initialize.
    """
    # Arrange
    mock_gemini_client.side_effect = Exception("Initialization Failed")

    # Act & Assert
    with pytest.raises(Exception, match="Initialization Failed"):
        # This will fail because the module is already loaded. 
        # We need to reload it to test the initialization logic.
        import importlib
        from stock_researcher.agents import portfolio_manager
        importlib.reload(portfolio_manager)
