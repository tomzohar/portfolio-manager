# Project Structure

## 📁 Final Pythonic Folder Structure

This project follows a standard, modular Python structure that separates concerns and makes the codebase clean, scalable, and easy to maintain.

```
stocks-researcher/
├── src/                                    # Source code
│   └── stock_researcher/                   # Main package
│       ├── __init__.py                     # Package initialization
│       ├── config.py                       # Configuration and environment variables
│       ├── orchestrator.py                 # 🎯 Main workflow orchestrator
│       │
│       ├── agents/                         # Agent modules with specific roles
│       │   ├── __init__.py
│       │   ├── portfolio_parser.py         # Agent 1: Parses portfolio from Google Sheets
│       │   ├── news_searcher.py            # Agent 2: Fetches news from SerpApi
│       │   ├── llm_analyzer.py             # Agent 3: Summarizes news with Gemini
│       │   ├── technical_analyzer.py       # Agent 4: Performs technical analysis with Gemini
│       │   └── portfolio_manager.py        # Agent 5: Generates final recommendations with Gemini
│       │
│       ├── data_fetcher/                   # Modules for retrieving external data
│       │   ├── __init__.py
│       │   └── ohlcv.py                      # Fetches OHLCV data from yfinance
│       │
│       ├── pre_processor/                  # Standalone data preparation scripts
│       │   ├── __init__.py
│       │   └── update_prices.py              # Logic to update prices in Google Sheets
│       │
│       ├── utils/                          # Shared utility functions
│       │   ├── __init__.py
│       │   ├── llm_utils.py                  # Centralized Gemini API call logic with retries
│       │   └── technical_analysis_utils.py   # Technical indicator calculation logic
│       │
│       └── notifications/                  # Modules for sending notifications
│           ├── __init__.py
│           └── whatsapp.py                 # WhatsApp integration via Twilio
│
├── tests/                                  # Unit and integration tests
│   ├── __init__.py
│   ├── test_llm_analyzer.py
│   ├── ... (other test files)
│
├── main.py                                 # 🚀 Main application entry point
├── update_prices_main.py                   # Standalone script for price updates
│
├── .env                                    # Environment variables (secret, gitignored)
├── .env.example                            # Template for .env
├── .gitignore                              # Git ignore rules
├── requirements.txt                        # Python dependencies
│
└── Documentation/
    ├── README.md                           # Main project documentation
    ├── ARCHITECTURE.md                     # High-level architecture details
    └── PROJECT_STRUCTURE.md                # This file
```

## 🎯 Benefits of This Structure

*   **Modularity**: Each component (agent, utility, data fetcher) has a distinct responsibility and location, making the system easy to understand and modify.
*   **Scalability**: The clear separation allows for new agents, data sources, or notification channels to be added with minimal disruption to existing code.
*   **Testability**: Isolating logic into distinct functions and modules makes it straightforward to write targeted unit tests and mock external dependencies.
*   **Maintainability**: A logical structure makes it easier for developers to find code, understand its purpose, and fix issues efficiently.
*   **Standard Convention**: Follows Python community best practices, making it familiar to new contributors.

