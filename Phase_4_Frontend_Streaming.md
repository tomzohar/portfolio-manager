# Phase 4: Frontend & Streaming - Technical Design Document [READY]

## 1. Executive Summary
Phase 4 focuses on bridging the gap between the stateful LangGraph.js backend and the Angular frontend. The goal is to provide a "Reasoning Console" that allows users to observe the agent's thought process in real-time, inspect past reasoning traces, and interact with "Human-in-the-Loop" (HITL) interrupts. This phase introduces real-time streaming via WebSockets and exposes the necessary REST endpoints for agent management.

**Status**: ⏳ **READY**

## 2. Technical Requirements
- **Real-time Updates**: Live streaming of graph execution steps (node transitions, tool calls, reasoning tokens).
- **Auditability**: Persistence and retrieval of `ReasoningTrace` entities.
- **Interactivity**: Ability to resume or abort suspended graph states (HITL).
- **Type Safety**: Shared types between backend and frontend for WebSocket events.

## 3. Task Breakdown (TDD Approach)

### 3.1 Task 1: API Expansion for Reasoning Console (Backend)
**Objective**: Expose endpoints to retrieve the state and reasoning history of an agentic thread.

#### 3.1.1 [TEST] Define `AgentsController` Specs
- **File**: `backend/src/modules/agents/controllers/agents.controller.spec.ts`
- **Requirements**:
    - `GET /agents/threads/:threadId/traces`: Should return an array of `ReasoningTrace` entities for the given thread, ordered by timestamp.
    - `GET /agents/threads/:threadId/status`: Should return the current status of the thread (RUNNING, SUSPENDED, COMPLETED).
    - `POST /agents/threads/:threadId/resume`: Should accept HITL input and resume the graph (Integration with `OrchestratorService`).

#### 3.1.2 [CODE] Implement `AgentsController` and DTOs
- **File**: `backend/src/modules/agents/controllers/agents.controller.ts`
- **File**: `backend/src/modules/agents/dto/reasoning-trace.dto.ts`
- **Requirement**: Ensure all endpoints are protected by `JwtAuthGuard` and use the `CurrentUser` decorator to enforce `userId` scoping.

---

### 3.2 Task 2: WebSocket Integration for Live Streaming (Backend)
**Objective**: Implement a WebSocket gateway to stream LangGraph events to the frontend.

#### 3.2.1 [TEST] Define `AgentsGateway` Specs
- **File**: `backend/src/modules/agents/services/agents.gateway.spec.ts`
- **Requirements**:
    - Should authenticate socket connections using JWT.
    - Should allow users to join a room specific to a `threadId`.
    - Should emit `agent_event` when the `OrchestratorService` publishes graph updates.

#### 3.2.2 [CODE] Implement `AgentsGateway`
- **File**: `backend/src/modules/agents/services/agents.gateway.ts`
- **Details**:
    - Use `@nestjs/websockets` with `socket.io`.
    - Subscribe to an internal `EventEmitter` or directly hook into the `OrchestratorService`'s LangGraph stream.
    - Event Payload: `{ type: 'node_start' | 'tool_call' | 'reasoning_chunk' | 'node_end', data: any }`.

---

### 3.3 Task 3: Frontend Reasoning Console (Figma-Driven)
**Objective**: Build the UI for the Reasoning Console using Figma designs.

#### 3.3.1 [PROMPT] Coding Agent Instructions
> **INSTRUCTION**: Before implementing the Reasoning Console UI, you must prompt the user to select the specific design from Figma. Use the Figma MCP to fetch the design assets and layout specifications.
> 1. Ask the user: "Please provide the Figma URL or select the frame for the 'Reasoning Console' design."
> 2. Once the design is selected, use `figma_get_file` or `figma_get_image` to inspect the components.
> 3. Implement the Angular component following the design system.

#### 3.3.2 [TEST] Define `ReasoningConsoleComponent` Specs
- **File**: `frontend/libs/feature-dashboard/src/lib/reasoning-console/reasoning-console.component.spec.ts`
- **Requirements**:
    - Should display a list of reasoning steps.
    - Should update the list in real-time when a WebSocket event is received.
    - Should show an interactive prompt when the state is `SUSPENDED`.

#### 3.3.3 [CODE] Implement `ReasoningConsoleComponent`
- **File**: `frontend/libs/feature-dashboard/src/lib/reasoning-console/reasoning-console.component.ts`
- **Details**:
    - Inject `AgentsService` (for REST) and `AgentsStreamService` (for WebSockets).
    - Use `NgRx` (if available) or a simple `BehaviorSubject` to manage the stream of traces.

---

### 3.4 Task 4: End-to-End Testing (The Sector Switcher Flow)
**Objective**: Verify the entire flow from UI trigger to real-time feedback.

#### 3.4.1 [TEST] Create E2E Test Case
- **File**: `backend/test/agents.e2e-spec.ts`
- **Scenario**: 
    1. User triggers "Sector Switcher" analysis.
    2. Backend initializes LangGraph.
    3. Backend emits streaming events via WebSockets.
    4. Test verifies that `ReasoningTrace` entities are created in the database.
    5. Test verifies that the WebSocket receives the expected sequence of events.

## 4. Implementation Guidelines
1. **Streaming Protocol**: Use LangGraph.js `stream()` method to capture events. Map these events to the WebSocket `agent_event` payload.
2. **Error Handling**: If the WebSocket connection drops, the frontend should fallback to polling the `GET /traces` endpoint to catch up on missed events.
3. **Security**: Ensure that users can only join WebSocket rooms for `threadId`s they own.

## 5. Success Criteria
- [ ] Users can see the agent "thinking" in real-time.
- [ ] Reasoning traces are persisted and can be viewed after the analysis is complete.
- [ ] The "Sector Switcher" flow executes successfully from the frontend with real-time feedback.

