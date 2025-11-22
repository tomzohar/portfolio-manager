# Project Structure

## 📁 Final Pythonic Folder Structure

This project follows a standard, modular Python structure that separates the new autonomous agent from the legacy system.

```
stocks-researcher/
├── src/                                    # Source code
│   ├── stock_researcher/                   # LEGACY: Main package for the original sequential pipeline
│   │   ├── __init__.py
│   │   ├── orchestrator.py                 # Main workflow orchestrator for the legacy system
│   │   └── agents/                         # Agent modules with specific roles
│   │       └── ... (and so on)
│   │
│   └── portfolio_manager/                  # NEW: Autonomous agent package
│       ├── __init__.py
│       ├── agent_state.py                  # Defines the AgentState schema for the graph
│       ├── tool_registry.py                # Decorator-based system for creating and managing tools
│       ├── prompts.py                      # Contains the master system prompt for the agent's "brain"
│       ├── schemas.py                      # Pydantic models for V3 (ExecutionPlan, ConflictResolution, etc.)
│       ├── integrations/                   # External API integrations
│       │   ├── polygon.py                  # Polygon.io market data (OHLCV, fundamentals)
│       │   └── fred.py                     # FRED API for macroeconomic data (GDP, CPI, yields)
│       ├── analysis/                       # Analysis modules
│       │   ├── technical_analyzer.py       # Technical indicator calculations
│       │   └── risk_calculator.py          # Portfolio risk metrics (Sharpe, Beta, VaR)
│       ├── graph/                          # LangGraph implementation
│       │   ├── builder.py                  # Assembles the graph nodes and edges
│       │   ├── edges.py                    # Conditional routing logic for the graph
│       │   └── nodes/                      # Directory containing each node's logic
│       │       ├── __init__.py
│       │       ├── start.py                # Initial portfolio parsing
│       │       ├── agent_decision.py       # Legacy: Agent's decision-making "brain"
│       │       ├── tool_execution.py       # Legacy: Tool executor
│       │       ├── final_report.py         # Final report generation
│       │       ├── guardrails.py           # Cost and safety guardrails
│       │       # Phase 2: Sub-Agent Nodes
│       │       ├── macro_agent.py          # Market regime analysis (FRED API)
│       │       ├── fundamental_agent.py    # Company valuation (Polygon.io)
│       │       ├── technical_agent.py      # Price trend analysis
│       │       ├── risk_agent.py           # Portfolio risk metrics
│       │       # Phase 3: Orchestration Nodes
│       │       ├── supervisor.py           # ✅ Multi-agent orchestration & delegation
│       │       ├── synthesis.py            # ⏳ Conflict resolution & recommendation synthesis
│       │       └── reflexion.py            # ⏳ Self-critique & quality assurance
│       └── tools/                          # Directory for all agent-callable tools
│           ├── __init__.py
│           ├── parse_portfolio.py
│           ├── analyze_news.py
│           ├── analyze_technicals.py
│           └── assess_confidence.py
│
├── tests/                                  # Unit and integration tests
│   └── ...
│
├── main.py                                 # 🚀 Entry point for the LEGACY sequential pipeline
├── run_portfolio_manager.py                # 🚀 Entry point for the NEW autonomous agent
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
