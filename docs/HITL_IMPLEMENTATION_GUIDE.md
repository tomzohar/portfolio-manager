# Human-in-the-Loop (HITL) Implementation Guide

## Overview

The agent system now supports Human-in-the-Loop (HITL) flows, allowing graph execution to pause and wait for human approval before proceeding. This enables critical operations like risk assessment approval, trade execution confirmation, and portfolio rebalancing decisions.

## Architecture

### Service Layer Design

The HITL system follows Single Responsibility Principle with three specialized services:

```
┌──────────────────────────────────────────────────────────┐
│                  OrchestratorService                      │
│  (Coordination, Validation, Events)                       │
│                                                           │
│  • Public API (runGraph, resumeGraph, streamGraph)       │
│  • User validation & security                            │
│  • Thread ID scoping                                     │
│  • Event emission for UI updates                         │
│  • Delegates to specialized services                     │
└────────────┬──────────────────────┬─────────────────────┘
             │                      │
    ┌────────▼─────────┐   ┌───────▼──────────────┐
    │ GraphExecutor    │   │ InterruptHandler     │
    │ Service          │   │ Service              │
    ├──────────────────┤   ├──────────────────────┤
    │ • Graph init     │   │ • Interrupt detect   │
    │ • invoke()       │   │ • Suspend validation │
    │ • getState()     │   │ • Reason extraction  │
    │ • updateState()  │   │ • Result building    │
    └──────────────────┘   └──────────────────────┘
```

**Why this split:**
- **Testability**: Mock each service independently
- **Maintainability**: <400 lines per service (DEVELOPER.md compliance)
- **Extensibility**: Add features without touching unrelated code
- **Type Safety**: Clear interfaces between layers

### Status Flow

```
START
  ↓
[Graph Execution]
  ↓
  ├─→ Success → COMPLETED
  ├─→ Error → FAILED
  └─→ Interrupt → SUSPENDED (waits for user input)
       ↓
     [Resume]
       ↓
     Continue execution
```

### Key Components

1. **GraphResult Status**
   - `SUSPENDED`: Graph paused, awaiting user input
   - `COMPLETED`: Graph finished successfully
   - `FAILED`: Graph encountered error

2. **Service Architecture**
   - **OrchestratorService**: Coordinates high-level workflows, validation, and security
   - **GraphExecutorService**: Manages LangGraph instance lifecycle and execution
   - **InterruptHandlerService**: Detects and manages graph interruptions
   - Each service has single responsibility for maintainability

3. **Interrupt Handling**
   - LangGraph's `interrupt()` function triggers suspension
   - InterruptHandlerService detects interrupt and extracts reason
   - OrchestratorService returns SUSPENDED status with interrupt reason

4. **State Persistence**
   - PostgreSQL checkpointer saves state automatically
   - State can be resumed from exact interrupt point

## Usage

### Triggering an Interrupt

From within a graph node:

```typescript
import { interrupt } from '@langchain/langgraph';
import { CIOState, StateUpdate } from '../types';

export function riskAssessmentNode(state: CIOState): StateUpdate {
  // Perform risk calculation
  const riskScore = calculateRisk(state.portfolio);
  
  // If risk is high, require human approval
  if (riskScore > 0.8) {
    interrupt(
      `High risk detected (${riskScore.toFixed(2)}). Please review and approve before proceeding.`
    );
    // Code after interrupt() will not execute
  }
  
  // Proceed normally if risk is acceptable
  return {
    messages: [new AIMessage('Risk assessment complete')],
    nextAction: 'execute_trade',
  };
}
```

### API Response

When interrupt occurs:

```json
{
  "threadId": "user123:thread456",
  "status": "SUSPENDED",
  "success": false,
  "interruptReason": "High risk detected (0.85). Please review and approve before proceeding.",
  "finalState": {
    "userId": "user123",
    "messages": [...],
    "portfolio": {...},
    "iteration": 2
  }
}
```

### Resuming Execution

**Coming in Task 3.3.2:**

```typescript
POST /api/agents/resume
{
  "threadId": "user123:thread456",
  "userInput": "approved"
}
```

## Testing

### Unit Tests

```bash
# Run HITL-specific tests
npm test -- orchestrator.service.hitl.spec.ts

# Run test node tests
npm test -- hitl-test.node.spec.ts
```

### Integration Testing

Use the test node to trigger interrupts:

```bash
curl -X POST http://localhost:3001/api/agents/run \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "trigger interrupt"}'
```

Keywords that trigger test interrupt: `interrupt`, `approval`, `hitl`

## Implementation Details

### Service Architecture

The HITL system is split into three specialized services for maintainability:

**1. GraphExecutorService** - Graph Lifecycle Management
```typescript
// Responsibilities: LangGraph instance management and execution
const graph = graphExecutor.getGraph();
const finalState = await graphExecutor.invoke(initialState, config);
const checkpoint = await graphExecutor.getState(config);
await graphExecutor.updateState(config, { messages: [...] });
```

**2. InterruptHandlerService** - Interrupt Detection & Management
```typescript
// Responsibilities: Detect interrupts and build suspended results
const interruptResult = interruptHandler.checkForInterrupt(finalState, threadId);
const isSuspended = interruptHandler.isThreadSuspended(checkpoint);
const isInterrupt = interruptHandler.isInterruptError(error);
const reason = interruptHandler.getInterruptReason(error);
```

**3. OrchestratorService** - High-Level Coordination
```typescript
// Responsibilities: Workflow orchestration, validation, event emission
async runGraph(userId, input, threadId?) {
  this.validateUserId(userId);
  const state = await graphExecutor.invoke(...);
  const result = interruptHandler.checkForInterrupt(state, threadId);
  return result || buildCompletedResult(state);
}
```

### Error Handling

The InterruptHandlerService identifies interrupt exceptions:

```typescript
// InterruptHandlerService.isInterruptError()
isInterruptError(error: GraphExecutionError): boolean {
  if (error?.name === 'NodeInterrupt' || error?.name === 'GraphValueError') {
    return true;
  }
  
  if (error?.message?.includes('NodeInterrupt') || 
      error?.message?.includes('No checkpointer set')) {
    return true;
  }
  
  return false;
}
```

### Checkpointer Requirements

**Production:**
- Requires PostgreSQL checkpointer configured
- State automatically persisted on interrupt
- Can resume from exact point

**Testing:**
- Works without checkpointer (in-memory mode)
- Interrupt throws `GraphValueError` but is caught gracefully
- State returned in exception (not persisted)

### Security

All interrupt handling respects user isolation:

```typescript
// ThreadID is scoped to user
const threadId = `${userId}:${generatedId}`;

// Resume validation (Task 3.3.2)
if (checkpoint.userId !== requestUserId) {
  throw new UnauthorizedException('Cannot resume another user\'s graph');
}
```

## Use Cases

### 1. Risk Assessment Approval

```typescript
export function riskAssessmentNode(state: CIOState): StateUpdate {
  const risks = analyzeRisks(state.portfolio);
  
  if (risks.severity === 'HIGH') {
    interrupt(`High risk detected: ${risks.description}. Requires approval.`);
  }
  
  return { approved: true, nextAction: 'proceed' };
}
```

### 2. Trade Execution Confirmation

```typescript
export function tradeExecutionNode(state: CIOState): StateUpdate {
  const trades = calculateTrades(state.portfolio);
  const totalValue = trades.reduce((sum, t) => sum + t.value, 0);
  
  if (totalValue > 100000) {
    interrupt(`About to execute ${trades.length} trades totaling $${totalValue}. Confirm?`);
  }
  
  return { executedTrades: trades, nextAction: 'complete' };
}
```

### 3. Portfolio Rebalancing Approval

```typescript
export function rebalancingNode(state: CIOState): StateUpdate {
  const rebalance = calculateRebalancing(state.portfolio);
  
  if (rebalance.changes.length > 10) {
    interrupt(`Rebalancing requires ${rebalance.changes.length} trades. Review before proceeding.`);
  }
  
  return { rebalanceComplete: true };
}
```

## Frontend Integration

### Handling SUSPENDED Status

```typescript
// React/Angular example
async function runAgent(message: string) {
  const response = await fetch('/api/agents/run', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  
  const result = await response.json();
  
  switch (result.status) {
    case 'SUSPENDED':
      // Show approval dialog
      showApprovalDialog({
        threadId: result.threadId,
        reason: result.interruptReason,
        onApprove: () => resumeGraph(result.threadId, 'approved'),
        onReject: () => resumeGraph(result.threadId, 'rejected'),
      });
      break;
      
    case 'COMPLETED':
      // Show results
      showResults(result.finalState);
      break;
      
    case 'FAILED':
      // Show error
      showError(result.error);
      break;
  }
}

async function resumeGraph(threadId: string, userInput: string) {
  // Task 3.3.2 - not yet implemented
  const response = await fetch('/api/agents/resume', {
    method: 'POST',
    body: JSON.stringify({ threadId, userInput }),
  });
  // Handle response (may be SUSPENDED again or COMPLETED)
}
```

## Configuration

### Enable/Disable Test Infrastructure

```typescript
// In router.node.ts - optional feature flag
export function routerNode(state: CIOState): string {
  const content = getMessageContent(state);
  
  // Only route to test node in test environment
  if (process.env.NODE_ENV === 'test' && 
      (content.includes('interrupt') || content.includes('hitl'))) {
    return 'hitl_test';
  }
  
  // ... regular routing
}
```

### Checkpoint Configuration

```typescript
// GraphExecutorService manages checkpointer
// Configured during graph compilation in buildCIOGraph()
const checkpointer = stateService.getSaver(); // PostgresSaver

const config = {
  configurable: {
    thread_id: scopedThreadId,
    performanceService: this.performanceService, // Services accessible in nodes
  },
  recursionLimit: 25,
};
```

## Troubleshooting

### "No checkpointer set" Error

**Cause:** LangGraph requires checkpointer for interrupt to work  
**Solution:** Ensure PostgreSQL checkpointer is configured in production

```typescript
// Verify checkpointer exists
if (!stateService.getSaver()) {
  throw new Error('Checkpointer required for HITL functionality');
}
```

### Interrupt Not Triggering

**Cause:** Graph compiled without checkpointer  
**Solution:** Check graph compilation includes checkpointer

```typescript
return workflow.compile({
  checkpointer: checkpointer as BaseCheckpointSaver
});
```

### State Not Persisted

**Cause:** Checkpoint not saved before interrupt  
**Solution:** LangGraph automatically saves on interrupt, verify database connection

## Performance Considerations

### Database Load
- Each interrupt creates checkpoint in PostgreSQL
- Checkpoints include full state (can be large)
- Consider retention policy for old checkpoints

### Timeout Handling
- Suspended graphs don't auto-expire (yet)
- Consider implementing cleanup job:

```typescript
@Cron('0 0 * * *') // Daily
async expireOldCheckpoints() {
  await this.checkpointRepository.delete({
    createdAt: LessThan(new Date(Date.now() - 7 * 86400000)) // 7 days
  });
}
```

## Files Structure

### Core Services
- `backend/src/modules/agents/services/orchestrator.service.ts` - High-level coordination (358 lines)
- `backend/src/modules/agents/services/graph-executor.service.ts` - LangGraph execution (124 lines)
- `backend/src/modules/agents/services/interrupt-handler.service.ts` - Interrupt management (149 lines)

### Types
- `backend/src/modules/agents/services/types/langgraph.types.ts` - LangGraph type definitions

### Test Infrastructure
- `backend/src/modules/agents/graphs/nodes/hitl-test.node.ts` - Test node for interrupts (enabled via `ENABLE_HITL_TEST_NODE=true`)
- `backend/src/modules/agents/graphs/nodes/hitl-test.node.spec.ts` - Test node unit tests

### Tests
- `backend/src/modules/agents/services/orchestrator.service.hitl.spec.ts` - HITL integration tests
- `backend/src/modules/agents/services/graph-executor.service.spec.ts` - Executor unit tests
- `backend/src/modules/agents/services/interrupt-handler.service.spec.ts` - Interrupt handler unit tests
- `backend/test/agents-hitl.e2e-spec.ts` - End-to-end HITL tests

## Related Documentation

- Task Report: `agents/task-331-report.md`
- Lessons Learned: `docs/LESSONS_LEARNED_TASK_3.3.1.md`
- Tests: `backend/src/modules/agents/services/orchestrator.service.hitl.spec.ts`
- Phase Plan: `phase-3-todos.json` (Task 3.3.1, 3.3.2)

## Next Steps

1. **Task 3.3.2:** Implement resume endpoint
2. **Task 3.4.1:** Add guardrails (iteration limits)
3. **Phase 4:** Implement production HITL nodes (risk, trade, rebalancing)

---

**Status:** ✅ Task 3.3.1 Complete  
**Next:** Task 3.3.2 (Resume Endpoint)  
**Last Updated:** 2026-01-16
