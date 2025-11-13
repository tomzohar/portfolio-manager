"""
Pytest configuration and fixtures
"""

import sys
from pathlib import Path
import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


@pytest.fixture
def sample_portfolio_data():
    """Sample portfolio data from Google Sheets"""
    return [
        ['symbol', 'price', 'position', 'market value', '% of total', 'total'],
        ['GOOGL', '278.57', '48', '13371.36', '20.84%', '64172.8'],
        ['PLTR', '172.14', '43', '7402.02', '11.53%', '64172.8'],
        ['AMZN', '237.58', '17', '4038.86', '6.29%', '64172.8'],
    ]


@pytest.fixture
def sample_news_results():
    """Sample news search results from SerpAPI"""
    return {
        'news_results': [
            {
                'title': 'Apple Q4 Earnings Beat Expectations',
                'snippet': 'Apple posted strong revenue growth',
                'source': 'CNBC',
                'link': 'https://example.com/article1'
            },
            {
                'title': 'Apple Stock Surges on AI News',
                'snippet': 'AI developments drive stock higher',
                'source': 'Bloomberg',
                'link': 'https://example.com/article2'
            }
        ]
    }


@pytest.fixture
def sample_llm_response():
    """Sample LLM response"""
    return """
**Summary Paragraph:** Apple reported strong Q4 earnings, beating expectations with significant revenue growth.

**Key Sentiment:** POSITIVE. Strong earnings performance and positive market reaction.

**Actionable Takeaway:** Investors should note the strong Q4 earnings beat and positive momentum in AI developments.
"""


@pytest.fixture
def mock_portfolio():
    """Create a mock Portfolio object"""
    from stock_researcher.agents.portfolio_parser import Portfolio, PortfolioPosition
    
    positions = [
        PortfolioPosition('GOOGL', 278.57, 48, 13371.36, 20.84),
        PortfolioPosition('PLTR', 172.14, 43, 7402.02, 11.53),
        PortfolioPosition('AMZN', 237.58, 17, 4038.86, 6.29),
    ]
    
    return Portfolio(positions=positions, total_value=64172.8)

