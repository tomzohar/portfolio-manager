import { CIOState, StateUpdate } from '../types';
import { AIMessage } from '@langchain/core/messages';

/**
 * Observer Node
 *
 * Entry point for the CIO graph.
 * Observes the current state and decides on next action.
 *
 * For Phase 1 "Hello World", this simply:
 * - Logs the current state
 * - Returns action to proceed to end node
 *
 * Note: Iteration counting is now handled by guardrail node
 */
export function observerNode(state: CIOState): StateUpdate {
  // For Phase 1, we just acknowledge and move to end
  const responseMessage = new AIMessage(
    `Observer node executed. This is iteration ${state.iteration}. ` +
      `Proceeding to completion.`,
  );

  return {
    messages: [...state.messages, responseMessage],
    nextAction: 'end',
  };
}
