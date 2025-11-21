"""
Tools Test Package

This package contains comprehensive test suites for each tool in the
autonomous portfolio manager.

Each tool has its own test module with 100% coverage including:
- Success cases
- Error handling
- Edge cases
- Logging verification

Test Modules:
- test_parse_portfolio: Tests for portfolio parsing from Google Sheets
- test_analyze_news: Tests for news fetching and summarization
- test_analyze_technicals: Tests for technical indicator analysis
- test_assess_confidence: Tests for confidence assessment logic

Run all tool tests:
    pytest tests/tools/ -v

Run with coverage:
    pytest tests/tools/ --cov=src.portfolio_manager.tools --cov-report=html
"""

# This file makes the tests/tools directory a Python package

