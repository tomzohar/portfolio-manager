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
 * Safety checkpoint that enforces iteration limits to prevent infinite loops.
 *
 * Behavior:
 * - Allows execution when iteration < maxIterations
 * - Throws GuardrailException when iteration >= maxIterations
 * - Does not mutate state (pure validation function)
 *
 * This acts as the first line of defense before the LangGraph recursion limit (25).
 * User-facing limit (maxIterations: 10) provides better UX than hitting system limit.
 *
 * @param state - Current CIO graph state
 * @returns Empty state update (no modifications needed)
 * @throws GuardrailException when iteration limit is reached
 */
export function guardrailNode(state: CIOState): StateUpdate {
  // Check if iteration limit has been reached
  if (state.iteration >= state.maxIterations) {
    const message =
      `Iteration limit reached (${state.iteration}/${state.maxIterations}). ` +
      `The agent attempted too many steps. ` +
      `Please simplify your request or contact support.`;

    throw new GuardrailException(message);
  }

  // Guardrail passed - no state changes needed
  // This is purely a checkpoint node
  return {};
}
