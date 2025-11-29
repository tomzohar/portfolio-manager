"""
Portfolio Manager Tools

This package contains all tools available to the autonomous portfolio manager agent.
Each tool is in its own module for maintainability and testability.

Tools are automatically registered when imported via the @tool decorator.
The public API uses the registry pattern - access tools by name, not by importing
the function directly.

Available Tools (auto-registered):
- parse_portfolio: Retrieve portfolio from Google Sheets
- analyze_news: Fetch and summarize recent news
- analyze_technicals: Calculate and interpret technical indicators
- assess_confidence: Evaluate data completeness

Usage:
    from src.portfolio_manager.tools import execute_tool, list_tools
    
    # Discover available tools
    tools = list_tools()
    
    # Execute by name
    result = execute_tool("parse_portfolio")
    result = execute_tool("analyze_news", tickers=["AAPL"])
"""

# Import all tool modules to trigger @tool decorator registration
# These imports have side effects (registration) but we don't export the functions
from . import parse_portfolio  # noqa: F401
from . import analyze_news  # noqa: F401
from . import analyze_technicals  # noqa: F401
from . import assess_confidence  # noqa: F401

# Import and export only the registry API
from ..tool_registry import (
    execute_tool,
    list_tools,
    generate_tools_prompt,
    get_registry,
)

# Public API - only registry functions, NOT individual tool functions
__all__ = [
    "execute_tool",
    "list_tools",
    "generate_tools_prompt",
    "get_registry",
]

