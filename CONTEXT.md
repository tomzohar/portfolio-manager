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

**Objective**: Make the project "production-ready."

The primary goal is to create a robust, automated system that can run the analysis daily without manual intervention and provide clear visibility into any failures.

**Current Status**: **Near Completion**

We have successfully completed the following major steps:

1.  **CI/CD Setup**:
    *   The project is hosted on GitHub.
    *   A CI workflow (`ci.yml`) is in place to automatically run the test suite.
    *   A production workflow (`production.yml`) is set up for manual and (eventually) scheduled runs.
2.  **Configuration & Secrets**:
    *   All secrets have been consolidated and are managed via GitHub Actions Secrets.
    *   The application code has been refactored to handle credentials securely, including using Base64 encoding for the multi-line Google credentials JSON.
3.  **API Reliability**:
    *   The unreliable `yfinance` library has been completely replaced with the professional-grade **Polygon API** for all financial data fetching (both daily prices and historical OHLCV data). This has resolved all data fetching failures observed in the cloud environment.
4.  **Bug Fixes & Refactoring**:
    *   The entire codebase has been debugged and refactored to work seamlessly in the GitHub Actions environment.
    *   The project has been restructured into a standard, installable Python package to ensure robust dependency management.

**Next and Final Step**:

The last remaining task is to **integrate Sentry for error monitoring and observability**. This will provide us with a robust system to automatically capture, alert on, and debug any exceptions that occur during the scheduled production runs, giving us the visibility needed to confidently automate the workflow.
