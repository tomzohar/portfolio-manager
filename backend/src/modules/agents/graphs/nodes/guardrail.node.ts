import { CIOState, StateUpdate } from '../types';

/**
 * GuardrailException
 *
 * Custom exception thrown when iteration limit is exceeded.
 * Provides clear error identification for orchestrator error handling.
 */
export class GuardrailException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuardrailException';

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GuardrailException);
    }
  }
}

/**
 * Guardrail Node
 *
 * Safety checkpoint that enforces limits to prevent infinite loops and excessive API costs.
 *
 * Behavior:
 * - Checks if iteration >= maxIterations and throws GuardrailException if true
 * - Checks if tool call count exceeds limit (prevents infinite ReAct loops)
 * - Increments iteration counter to track graph executions
 * - Acts as the first line of defense before LangGraph recursion limit (25)
 *
 * This provides a user-facing limit (maxIterations: 10, maxToolCalls: 15) with better
 * error messages than hitting the system recursionLimit.
 *
 * @param state - Current CIO graph state
 * @returns State update with incremented iteration counter
 * @throws GuardrailException when iteration or tool call limit is reached
 */
export function guardrailNode(state: CIOState): StateUpdate {
  const currentIteration = state.iteration ?? 0;
  const maxIterations = state.maxIterations ?? 10;

  // Check if iteration limit has been reached
  if (currentIteration >= maxIterations) {
    const message =
      `Iteration limit reached (${currentIteration}/${maxIterations}). ` +
      `The agent attempted too many steps. ` +
      `Please simplify your request or contact support.`;

    throw new GuardrailException(message);
  }

  // Count tool calls to prevent infinite tool calling loops (ReAct pattern safety)
  const maxToolCalls = 15;
  const toolCallCount = state.messages.filter(
    (msg) => msg._getType() === 'tool',
  ).length;

  if (toolCallCount > maxToolCalls) {
    const message =
      `Tool call limit exceeded (${toolCallCount}/${maxToolCalls}). ` +
      `The agent called too many tools. This may indicate a reasoning loop. ` +
      `Please simplify your request or contact support.`;

    throw new GuardrailException(message);
  }

  // Increment iteration counter for next pass
  return {
    iteration: currentIteration + 1,
  };
}
