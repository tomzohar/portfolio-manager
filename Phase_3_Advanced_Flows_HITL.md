# Phase 3: Advanced Flows & HITL - Technical Design & TDD Roadmap

This document breaks down Phase 3 of the Digital CIO refactor into small, testable tasks following Test-Driven Development (TDD) principles. Phase 3 introduces complex multi-node reasoning, human-in-the-loop (HITL) mechanics, and the "Alpha Auditor" performance attribution flow.

---

## 1. Performance Attribution Engine (The Alpha Auditor)

To support "The Alpha Auditor" flow, we need to extend our business logic services to calculate portfolio returns and compare them against benchmarks.

### Task 1.1: `PerformanceService` Expansion
**Objective**: Implement calculation logic for internal returns and benchmark comparisons.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/portfolio/services/performance.service.spec.ts`.
    - Assert that `calculateInternalReturn(userId, timeframe)` correctly computes returns based on transaction history and current prices.
    - Assert that `getBenchmarkComparison(benchmarkTicker, timeframe)` returns the relative performance (Alpha).
- **TDD Step (GREEN)**: 
    - Implement the methods in `PerformanceService`.
    - Use `TransactionsService` for historical flows and `AssetsService` for historical/current price data.
- **Acceptance Criteria**: 
    - Calculation matches a "ground truth" spreadsheet for a sample portfolio.
    - Handles edge cases like zero-balance portfolios or missing price data.

### Task 1.2: `AlphaAuditorGraph` Implementation
**Objective**: Create a specialized LangGraph for performance attribution and "Alpha" discovery.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/graphs/alpha-auditor.graph.spec.ts`.
    - Mock `PerformanceService` and `AssetsService`.
    - Assert that when asked "Why did I underperform?", the graph:
        1. Calls `calculateInternalReturn`.
        2. Calls `getBenchmarkComparison`.
        3. Invokes a "Synthesis" node to explain the delta.
- **TDD Step (GREEN)**: 
    - Define the `AlphaAuditorGraph` in `backend/src/modules/agents/graphs/alpha-auditor.graph.ts`.
    - Register the graph in `OrchestratorService`.
- **Acceptance Criteria**: 
    - Integration test confirms the graph provides a detailed breakdown of performance attribution (e.g., "sector drag" or "specific ticker failure").

---

## 2. Human-In-The-Loop (HITL) Mechanics

HITL allows the agent to pause execution when it reaches a high-stakes decision (e.g., suggesting a trade) and wait for user approval.

### Task 2.1: Interrupt & Suspend Logic
**Objective**: Implement LangGraph.js `interrupt` to pause the graph and save a "SUSPENDED" state.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/services/orchestrator.service.hitl.spec.ts`.
    - Define a dummy graph with an `interrupt`.
    - Assert that calling `orchestrator.run()` on this graph returns a status indicating it is paused.
    - Assert that the `AgentState` entity in the DB is marked as `status: SUSPENDED`.
- **TDD Step (GREEN)**: 
    - Use `interrupt()` in the graph definition.
    - Update `OrchestratorService` to handle the `NodeInterrupt` exception and update the `AgentState` status.
- **Acceptance Criteria**: 
    - The graph execution stops exactly at the interrupt point, and the state is persisted.

### Task 2.2: Resume Execution via API
**Objective**: Provide an endpoint to resume a suspended graph with user feedback.

- **TDD Step (RED)**: 
    - Create a test in `backend/test/agents-hitl.e2e-spec.ts`.
    - Trigger a graph that interrupts.
    - Send a `POST /agents/resume` with the `threadId` and user input (e.g., "Approve").
    - Assert that the graph completes and the state becomes `COMPLETED`.
- **TDD Step (GREEN)**: 
    - Add a `resumeGraph(threadId, input)` method to `OrchestratorService`.
    - Implement the controller endpoint.
- **Acceptance Criteria**: 
    - The agent successfully ingests the user's decision and continues execution from where it left off.

---

## 3. Reasoning Traces & Explainability

We need to capture the "thoughts" of the LLM at every node to populate the Reasoning Console in the UI.

### Task 3.1: Trace Capture Middleware
**Objective**: Implement a mechanism to capture LLM reasoning during graph execution and save it to the `ReasoningTrace` entity.

- **TDD Step (RED)**: 
    - Update `backend/src/modules/agents/services/orchestrator.service.spec.ts`.
    - Assert that after a graph run, multiple `ReasoningTrace` records exist in the database for the given `threadId`.
    - Each record must contain the `nodeName` and the `reasoning` (LLM's internal monologue).
- **TDD Step (GREEN)**: 
    - Implement a custom `BaseTracer` or use LangGraph's `metadata` and `tags` to extract the "thought" property from the LLM response.
    - Save these to the `ReasoningTrace` repository at the end of each node execution (or via a callback).
- **Acceptance Criteria**: 
    - The "Reasoning Console" data is fully populated for every agent run, allowing the user to see *why* a tool was called.

---

## 4. Stability & Guardrails (Advanced)

### Task 4.1: The "Budget Breaker" Guardrail
**Objective**: Prevent the agent from entering infinite loops or consuming too many tokens in a single session.

- **TDD Step (RED)**: 
    - Create a test that mocks a tool to always return "Needs more info," triggering a loop.
    - Assert that the graph terminates with a `GuardrailException` after 5 iterations.
- **TDD Step (GREEN)**: 
    - Implement a `recursionLimit` in the LangGraph `RunnableConfig`.
    - Add a custom node that checks `state.iterationCount` and throws if it exceeds a threshold.
- **Acceptance Criteria**: 
    - No single analysis can exceed a hard-coded "Credit Limit" (tokens or iterations).

---

## Directory Structure (End of Phase 3)

```text
backend/src/modules/
├── agents/
│   ├── graphs/
│   │   ├── cio.graph.ts
│   │   └── alpha-auditor.graph.ts
│   ├── controllers/
│   │   └── agents.controller.ts (resume endpoint)
│   ├── services/
│   │   ├── orchestrator.service.ts (HITL logic)
│   │   └── tracing.service.ts      # New service for capturing traces
│   └── dto/
│       └── resume-graph.dto.ts
└── portfolio/
    └── services/
        └── performance.service.ts
```

