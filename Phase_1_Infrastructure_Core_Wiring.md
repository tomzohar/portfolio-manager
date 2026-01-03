# Phase 1: Infrastructure & Core Wiring - Technical Design & TDD Roadmap

This document breaks down Phase 1 of the Digital CIO refactor into small, testable tasks following Test-Driven Development (TDD) principles.

## 1. Environment & Dependencies

### Task 1.1: Project Initialization & Dependency Management
**Objective**: Install core libraries and ensure the TypeScript environment is ready for LangGraph.js and other required tools.

- **TDD Step (RED)**: 
    - Create a temporary test file `backend/test/dependency-check.spec.ts`.
    - Try to import `@langchain/langgraph` and `technicalindicators`. (Note: `zod` is already installed).
    - Run `npm test` and confirm it fails because modules are missing.
- **TDD Step (GREEN)**: 
    - Run `npm install @langchain/langgraph technicalindicators @langchain/openai @langchain/core`.
    - Update `tsconfig.json` if necessary to support the new libraries.
- **TDD Step (REFACTOR)**: 
    - Verify all dependencies are in `dependencies` and not `devDependencies` if required for runtime.
- **Acceptance Criteria**: 
    - `npm test` passes for the dependency check.
    - No compilation errors in the NestJS build process.

---

## 2. Persistence Layer (TypeORM)

### Task 2.1: `AgentState` Entity Implementation
**Objective**: Create the entity to persist LangGraph checkpoints, scoped by `userId`.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/entities/agent-state.entity.spec.ts`.
    - Assert that an `AgentState` can be saved with a `threadId`, `userId`, and a JSONB `checkpoint`.
- **TDD Step (GREEN)**: 
    - Create `backend/src/modules/agents/entities/agent-state.entity.ts`.
    - Add to `AgentsModule` and register in TypeORM.
- **TDD Step (REFACTOR)**: 
    - Ensure indexes are added for `userId` and `threadId`.
- **Acceptance Criteria**: 
    - Database migration is generated and successfully applied.
    - Unit tests confirm CRUD operations on `AgentState`.

### Task 2.2: `ReasoningTrace` Entity Implementation
**Objective**: Create the entity to store the "thought process" of the agent for the Reasoning Console.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/entities/reasoning-trace.entity.spec.ts`.
    - Assert that a trace can be linked to a `threadId` and contains `nodeName`, `input`, `output`, and `reasoning`.
- **TDD Step (GREEN)**: 
    - Create `backend/src/modules/agents/entities/reasoning-trace.entity.ts`.
- **Acceptance Criteria**: 
    - Unit tests confirm a trace can be saved and retrieved by `threadId`.

---

## 3. Core Services & Orchestration

### Task 3.1: `StateService` (Checkpoint Saver)
**Objective**: Implement a custom LangGraph `BaseCheckpointSaver` that uses our `AgentState` entity.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/services/state.service.spec.ts`.
    - Mock the `AgentState` repository.
    - Assert that `stateService.put()` saves to the DB and `stateService.get()` retrieves it.
- **TDD Step (GREEN)**: 
    - Implement `StateService` in `backend/src/modules/agents/services/state.service.ts` extending `BaseCheckpointSaver`.
- **Acceptance Criteria**: 
    - The service correctly serializes/deserializes LangGraph state objects.

### Task 3.2: `ToolRegistry` Service
**Objective**: A central place to register and retrieve tools, ensuring they are injected with NestJS services.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/services/tool-registry.service.spec.ts`.
    - Assert that `registry.getTools()` returns an array of `DynamicStructuredTool` objects.
- **TDD Step (GREEN)**: 
    - Implement `ToolRegistryService` and a basic dummy tool (e.g., `get_current_time`).
- **Acceptance Criteria**: 
    - Tools are correctly typed with Zod schemas.

---

## 4. Guardrails & Middleware

### Task 4.1: `TokenUsageService` & `PricingMiddleware`
**Objective**: Track token usage for every LLM call and attribute it to a `userId`.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/services/token-usage.service.spec.ts`.
    - Assert that calling `recordUsage(userId, tokens)` updates the user's total in the DB.
- **TDD Step (GREEN)**: 
    - Implement `TokenUsageService`.
    - Create a LangChain callback handler that invokes this service.
- **Acceptance Criteria**: 
    - Every LLM response triggers a usage record in the database.

---

## 5. The "Hello World" CIO Graph

### Task 5.1: `CIOOrchestrator` & Basic Graph
**Objective**: Create the simplest functional LangGraph that can be triggered via an API.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/graphs/cio.graph.spec.ts`.
    - Mock the LLM and a tool.
    - Invoke the graph and assert that it transitions from `Observer` to `End`.
- **TDD Step (GREEN)**: 
    - Define the graph using `StateGraph` in `backend/src/modules/agents/graphs/cio.graph.ts`.
    - Implement the `OrchestratorService` to run the graph.
- **Acceptance Criteria**: 
    - An integration test can run the graph end-to-end and see the state saved in the database.

---

## Directory Structure (Phase 1)
```text
backend/src/modules/agents/
├── entities/
│   ├── agent-state.entity.ts
│   └── reasoning-trace.entity.ts
├── services/
│   ├── state.service.ts        # Checkpoint Saver
│   ├── tool-registry.service.ts
│   ├── token-usage.service.ts
│   └── orchestrator.service.ts
├── graphs/
│   └── cio.graph.ts
├── dto/
│   └── run-graph.dto.ts
└── agents.module.ts
```

