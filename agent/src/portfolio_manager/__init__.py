"""
Autonomous Portfolio Manager Agent

This package implements an intelligent, autonomous agent system that dynamically
analyzes stock portfolios using LangGraph. Unlike the sequential pipeline in
stock_researcher, this agent makes decisions about what data to gather and
which analyses to perform based on the current portfolio state.

The agent uses LangGraph to create a stateful, event-driven workflow where
the Portfolio Manager can iteratively refine its understanding before
delivering actionable recommendations.
"""

__version__ = "1.0.0"

