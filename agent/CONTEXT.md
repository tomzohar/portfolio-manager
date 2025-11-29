# Project Context: Stocks Researcher

This document provides a summary of the Stocks Researcher project, its architecture, and the current status of its production readiness deployment.

## Project Overview

The Stocks Researcher is a Python-based, multi-agent AI system designed to automate stock portfolio analysis. It performs the following key functions:

1.  **Data Ingestion**: Parses a stock portfolio from a Google Sheet.
2.  **Price Updates**: Fetches the latest daily stock prices from the Polygon API to ensure the portfolio valuation is current.
3.  **News Aggregation**: Searches for recent news articles for each stock using the SerpApi.
4.  **AI-Powered Analysis**:
    *   **Fundamental**: Uses Google's Gemini Flash model to summarize news articles and generate sentiment scores.
    *   **Technical**: Fetches historical OHLCV data from the Polygon API, calculates technical indicators (`SMA`, `RSI`, `MACD`), and uses Gemini Flash for a technical summary.
5.  **Holistic Recommendation**: A final "Portfolio Manager" agent uses the powerful Gemini Pro model to synthesize all the data (portfolio structure, news summaries, technical analysis) into a holistic assessment and generate actionable recommendations (e.g., INCREASE/DECREASE position).
6.  **Notification**: Delivers the final report via WhatsApp using the Twilio API.

## Architecture & Technology

The project is structured as a modern, installable Python package. It is designed to be run in automated environments, particularly as a scheduled GitHub Action.

-   **Core Technologies**: Python 3.12, Pandas, Google Gemini, Polygon API, SerpApi, Twilio, gspread.
-   **CI/CD**: The project is hosted on GitHub and uses GitHub Actions for both Continuous Integration (running `pytest` on every push) and for scheduled production runs.
-   **Configuration**: All secrets and configuration are managed via environment variables, loaded from a `.env` file for local development and from GitHub Secrets in production.

## Current Task & Status

**Objective**: Maintain and enhance the production-ready Autonomous Portfolio Manager.

**Current Status**: **Production Ready (V3 Complete)**

We have successfully completed the transition to a V3 Supervisor-based Multi-Agent Architecture:

1.  **V3 Architecture Implemented**:
    *   **Supervisor Node**: Orchestrates analysis using a ReAct pattern.
    *   **Specialized Sub-Agents**: Macro (FRED), Fundamental (Polygon), Technical, and Risk agents.
    *   **Synthesis & Reflexion**: Advanced conflict resolution and self-critique loops.
    *   **Structured Output**: Comprehensive JSON reports with confidence scores.

2.  **CI/CD & Reliability**:
    *   **GitHub Actions**: Automated testing and scheduled runs.
    *   **Sentry Integration**: Full error monitoring and alerting implemented.
    *   **API Reliability**: Robust retry logic for Polygon, FRED, and Gemini APIs.

3.  **Testing**:
    *   **495+ Tests Passing**: 100% pass rate across unit, integration, and end-to-end tests.

**Next Steps**:
- Monitor V3 performance in production.
- Gather user feedback on report quality.

