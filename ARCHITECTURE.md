# Stock Researcher Architecture

## High-Level Overview

This project is designed as a modular, multi-agent system that automates the process of stock research and portfolio analysis. An orchestrator function (`research_portfolio_news`) sequences the calls to various agents, each responsible for a specific task. This design allows for clear separation of concerns, easy testing, and straightforward extensibility.

The workflow is now fully parallelized for performance, with API calls for news summarization and technical analysis running concurrently.

## Project Structure

```
stocks-researcher/
├── src/
│   └── stock_researcher/
│       ├── __init__.py
│       ├── config.py                    # Configuration & env variables
│       ├── orchestrator.py              # 🎯 ORCHESTRATOR - Main workflow
│       │
│       ├── agents/                      # Agent modules
│       │   ├── __init__.py
│       │   ├── portfolio_parser.py      # Agent 1: Portfolio parser
│       │   ├── news_searcher.py         # Agent 2: News search (SerpAPI)
│       │   ├── llm_analyzer.py          # Agent 3: News Summarizer (Gemini)
│       │   ├── technical_analyzer.py    # Agent 4: Technical Analysis (Gemini)
│       │   └── portfolio_manager.py     # Agent 5: Recommendations (Gemini)
│       │
│       ├── data_fetcher/                # Data retrieval modules
│       │   └── ohlcv.py                   # OHLCV data from yfinance
│       │
│       ├── pre_processor/               # Standalone data preparation scripts
│       │   └── update_prices.py         # Updates prices in Google Sheet
│       │
│       ├── utils/                       # Shared utility functions
│       │   ├── llm_utils.py               # Centralized Gemini API calls
│       │   └── technical_analysis_utils.py # TA indicator calculations
│       │
│       └── notifications/               # Output modules
│           └── whatsapp.py              # WhatsApp notifications (Twilio)
│
├── main.py                              # Main entry point for analysis
├── update_prices_main.py                # Standalone script for price updates
│
├── tests/                               # Unit and integration tests
│
├── Configuration:
│   ├── .env / .env.example
│   └── requirements.txt
│
└── Documentation:
    ├── README.md
    └── ARCHITECTURE.md                  # This file
```

## Workflow Architecture

The workflow is orchestrated by `main.py`, which calls agents in a sequence. Data fetching and AI analysis tasks are parallelized for performance.

```
┌─────────────────────────┐      ┌───────────────────────────┐
│ update_prices_main.py   │      │         main.py           │
│ (Optional, Standalone)  │      │       (Entry Point)       │
└────────────┬────────────┘      └────────────┬──────────────┘
             │                                 │
             ▼                                 ▼
┌─────────────────────────┐      ┌───────────────────────────┐
│     Google Sheets       │◀────▶│      Orchestrator         │
│ (Portfolio Data Store)  │      │ (research_portfolio_news) │
└─────────────────────────┘      └┬──────────┬──────────┬───┘
                                  │          │          │
 ─────────────────────────────────┼──────────┼──────────┼──────────────────────────────
                                  │          │          │
                                  ▼          │          │
┌─────────────────────────────────┴────────┐ │          │
│             Agent 1                      │ │          │
│      (Parse Portfolio)                   │ │          │
└──────────────────────────────────────────┘ │          │
                                  │          │          │
                                  ▼          │          │
┌─────────────────────────────────┴────────┐ │          │
│             Agent 2                      │ │          │
│       (Search for News)                  │ │          │
└──────────────────────────────────────────┘ │          │
                                  │          │          │
                 ┌────────────────┼──────────┘          │
                 │                │                     │
                 ▼                ▼                     ▼
┌────────────────┴───────┐  ┌─────┴──────────────────┐ ┌─┴────────────────────┐
│       Agent 3          │  │        Agent 4         │ │       Agent 5        │
│ (Summarize News - AI)  │  │ (Technical Analyis - AI) │ │ (Recommendations - AI) │
└────────────────────────┘  └────────────────────────┘ └──────────────────────┘
                 │                │                     │
                 └────────────────┼──────────┬──────────┘
                                  │          │
                                  ▼          ▼
                          ┌────────┴────────┐┌──────────┴────────┐
                          │ Display Results ││ Send Notifications│
                          │   (Console)     ││    (WhatsApp)     │
                          └─────────────────┘└───────────────────┘

```

## Agent Responsibilities

### Agent 1: Portfolio Parser (`agents/portfolio_parser.py`)
- **Process:** Connects to Google Sheets and parses the portfolio data into structured `Portfolio` and `PortfolioPosition` objects.

### Agent 2: News Searcher (`agents/news_searcher.py`)
- **Process:** Uses the SerpApi to search for recent news articles for each stock ticker in the portfolio.

### Agent 3: News Summarizer (`agents/llm_analyzer.py`)
- **Process:** For each stock, sends the news articles to the Gemini AI to generate a concise executive summary, sentiment analysis, and an actionable takeaway. Calls are made concurrently.

### Agent 4: Technical Analyst (`agents/technical_analyzer.py`)
- **Process:** Fetches 1 year of historical OHLCV data. It then calculates key technical indicators (SMA, RSI, MACD) and sends these indicators to the Gemini AI for a concise technical health summary. Calls are made concurrently.

### Agent 5: Portfolio Manager (`agents/portfolio_manager.py`)
- **Process:** This is the final reasoning engine. It takes the original portfolio structure, all the news summaries, and all the technical analyses, and sends them to the Gemini AI in a single prompt. It asks the model to provide an overall portfolio assessment and generate specific, actionable recommendations (INCREASE/DECREASE).

## Core Utilities

### `utils/llm_utils.py`
- Centralizes all interactions with the Google Gemini API.
- Handles client initialization and includes a robust `call_gemini_api` function with `tenacity` for automatic retries with exponential backoff. This makes all AI calls resilient to temporary network failures.

### `utils/technical_analysis_utils.py`
- Contains the `calculate_technical_indicators` function.
- Uses the `pandas-ta` library to calculate SMA, RSI, and MACD from raw OHLCV data, providing a clean dictionary of indicators for the Technical Analyst Agent.

## Decoupled Price Updater

The `update_prices_main.py` script is a standalone utility for updating the stock prices in the Google Sheet. This was intentionally decoupled from the main workflow to ensure that the core analysis can still run even if the `yfinance` API is temporarily unavailable. It uses the same robust, retry-enabled fetching logic.

