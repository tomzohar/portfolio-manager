"""
Tool Registry Public API

This file provides the public interface for the tool registry system.
Tools are automatically discovered via the @tool decorator - no manual
registration needed!

Public API:
    execute_tool(name, **kwargs) - Execute a tool by name
    list_tools() - List all registered tools
    generate_tools_prompt() - Generate LLM prompt with tool descriptions
    get_registry() - Access the registry directly

Usage:
    from src.portfolio_manager.tools import execute_tool, list_tools
    
    # Discover tools
    tools = list_tools()
    # ['parse_portfolio', 'analyze_news', 'analyze_technicals', ...]
    
    # Execute by name
    result = execute_tool("parse_portfolio")
    
    # Execute with args
    result = execute_tool("analyze_news", tickers=["AAPL", "MSFT"])

Adding New Tools:
    Simply create a new file in tools/ with @tool decorator:
    
    @tool(name="my_tool", description="...")
    def my_tool() -> ToolResult:
        ...
    
    It's automatically registered and available via execute_tool()!
"""

# Import all tools to trigger registration via @tool decorators
from .tools import (  # noqa: F401
    parse_portfolio,
    analyze_news, 
    analyze_technicals,
    assess_confidence,
)

# Export only the registry API - NOT individual tool functions
from .tools import (
    execute_tool,
    list_tools,
    generate_tools_prompt,
    get_registry,
)

__all__ = [
    # Registry API (public)
    "execute_tool",
    "list_tools",
    "generate_tools_prompt",
    "get_registry",
    # Note: Individual tool functions are NOT exported
    # Use execute_tool("tool_name") instead
]
