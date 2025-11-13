"""
Stock Researcher
Automated stock portfolio research with AI-powered analysis
"""

__version__ = "1.0.0"

from .orchestrator import research_portfolio_news
from .agents.portfolio_parser import Portfolio, PortfolioPosition

__all__ = [
    "research_portfolio_news",
    "Portfolio",
    "PortfolioPosition",
]

