# Phase 3: Advanced Flows & HITL - Technical Design & TDD Roadmap [IN PROGRESS]

This document breaks down Phase 3 of the Digital CIO refactor into small, testable tasks following Test-Driven Development (TDD) principles. Phase 3 introduces complex multi-node reasoning, human-in-the-loop (HITL) mechanics, and reasoning trace capture for transparency.

**Status**: 🏗️ **IN PROGRESS** (Tasks 3.1.1-3.1.2 Complete)

**Progress Tracker:**
- ✅ Task 3.1.1: TracingService Implementation (Completed: Jan 15, 2026)
- ✅ Task 3.1.2: Automatic Tracing Middleware (Completed: Jan 15, 2026)
- 🔄 Task 3.1.3: SSE Streaming Endpoint (Next)

**Detailed Task Breakdown:** See `phase-3-todos.json` for complete task specifications.

---

## Milestone 1: Tracing Foundation ✅ (2/5 Complete)

### Task 3.1.1: TracingService (TDD) ✅ COMPLETED

**Objective**: Implement service to capture and persist agent reasoning traces to database.

**Status**: ✅ **COMPLETED** (January 15, 2026)

**Implementation Details:**
- **Files Created:**
  - `backend/src/modules/agents/services/tracing.service.ts` (103 LOC)
  - `backend/src/modules/agents/services/tracing.service.spec.ts` (434 LOC)
- **Files Modified:**
  - `backend/src/modules/agents/agents.module.ts`

**Test Results:**
- ✅ 14 unit tests passing
- ✅ 100% coverage of public methods
- ✅ Zero lint errors
- ✅ All acceptance criteria met

**Service Methods:**
```typescript
// Record a reasoning trace
await tracingService.recordTrace(threadId, userId, nodeName, input, output, reasoning);

// Get traces by thread (chronological order)
const traces = await tracingService.getTracesByThread(threadId, userId);

// Get recent traces by user (with limit)
const recentTraces = await tracingService.getTracesByUser(userId, limit?);
```

**Key Features:**
- Security: userId validation enforced
- Performance: Optimized database indexes
- Flexibility: JSONB columns for input/output
- Documentation: Comprehensive JSDoc comments

**Lessons Learned:** See `backend/docs/LESSONS_LEARNED_TASK_3.1.1.md`

---

### Task 3.1.2: Automatic Tracing Middleware ✅ COMPLETED

**Objective**: Build reusable tracing infrastructure that auto-traces all nodes without manual integration.

**Status**: ✅ **COMPLETED** (January 15, 2026)

**Implementation Details:**
- **Files Created:**
  - `backend/src/modules/agents/callbacks/tracing-callback.handler.ts` (174 LOC)
  - `backend/src/modules/agents/callbacks/tracing-callback.handler.spec.ts` (569 LOC)
  - `backend/src/modules/agents/graphs/middleware/with-tracing.ts` (79 LOC)
  - `backend/src/modules/agents/graphs/middleware/with-tracing.spec.ts` (437 LOC)
- **Files Modified:**
  - `backend/src/modules/agents/graphs/types.ts` (added threadId to CIOState)

**Test Results:**
- ✅ 31 unit tests passing (18 callback handler + 13 middleware)
- ✅ 100% coverage of all methods
- ✅ Zero lint errors
- ✅ Code review passed (all MINOR issues resolved)
- ✅ All acceptance criteria met

**Architecture Components:**

1. **TracingCallbackHandler** (Automatic Tracing)
   - Extends LangChain's `BaseCallbackHandler`
   - Automatic tracing for ALL nodes (no code changes needed)
   - Real-time token streaming (ChatGPT-style UX)
   - Event-driven architecture via EventEmitter2

```typescript
// LLM Streaming Hooks (Level 3 UX - Token-by-Token)
handleLLMStart()     → emit 'llm.start'
handleLLMNewToken()  → emit 'llm.token' (character-by-character)
handleLLMEnd()       → emit 'llm.complete' + save to DB

// Node Execution Hooks (Complete Traces)
handleChainStart()   → Track node input
handleChainEnd()     → Save complete trace + emit 'node.complete'
```

2. **withTracing() HOF** (Optional Custom Reasoning)
   - Higher-order function for explicit tracing
   - Use ONLY when customizing reasoning messages
   - Graceful degradation (tracing failures don't break nodes)

```typescript
export const performanceNode = withTracing('performance_attribution', async (state) => {
  return {
    alpha: -0.06,
    reasoning: 'Portfolio underperformed due to tech overweight'
  };
});
```

**Event Schema:**
```typescript
// Real-time events for frontend consumption
'llm.start'      → { threadId, userId, timestamp }
'llm.token'      → { threadId, userId, token, timestamp }
'llm.complete'   → { threadId, userId, reasoning, timestamp }
'node.complete'  → { threadId, userId, nodeName, timestamp }
```

**Key Features:**
- ✅ Fully automatic tracing (new nodes get tracing automatically)
- ✅ True real-time streaming (token-by-token like ChatGPT)
- ✅ Database persistence for historical queries
- ✅ Event-driven for concurrent users
- ✅ Security-aware (userId filtering)
- ✅ Production-ready error handling
- ✅ NestJS Logger integration
- ✅ Type-safe with proper error guards

**Architectural Decision:**
Hybrid approach combining:
- **LangGraph Callbacks** (BEST) - Fully automatic, scales perfectly
- **withTracing() HOF** (GOOD) - Explicit opt-in for custom reasoning

This eliminates manual tracing boilerplate and ensures all future nodes get tracing automatically.

**Next Steps:** 
- Task 3.1.3: Create SSE endpoint to stream events to frontend
- Task 3.1.4: Create REST endpoint for historical traces
- Integration: Wire up TracingCallbackHandler in orchestrator.service.ts

**Report:** See `task-312-report.md` for detailed implementation report

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

