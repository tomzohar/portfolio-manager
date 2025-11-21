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
│       ├── graph/                          # LangGraph implementation
│       │   ├── builder.py                  # Assembles the graph nodes and edges
│       │   ├── nodes/                      # Directory containing each node's logic (e.g., agent_decision)
│       │   └── edges.py                    # Conditional routing logic for the graph
│       └── tools/                          # Directory for all agent-callable tools
│           ├── __init__.py
│           ├── parse_portfolio.py
│           └── ... (other tool files)
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
