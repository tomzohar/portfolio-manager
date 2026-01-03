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
 * - Increments iteration
 * - Returns action to proceed to end node
 */
export function observerNode(state: CIOState): StateUpdate {
  // Increment iteration count
  const newIteration = state.iteration + 1;

  // For Phase 1, we just acknowledge and move to end
  const responseMessage = new AIMessage(
    `Observer node executed. This is iteration ${newIteration}. ` +
      `Proceeding to completion.`,
  );

  return {
    messages: [...state.messages, responseMessage],
    nextAction: 'end',
    iteration: newIteration,
  };
}
