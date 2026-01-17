import { interrupt } from '@langchain/langgraph';
import { CIOState, StateUpdate } from '../types';
import { AIMessage } from '@langchain/core/messages';

/**
 * HITL Test Node
 *
 * Purpose: Test node for Human-in-the-Loop (HITL) interrupt functionality
 *
 * This node is used ONLY for testing interrupt/suspend logic (Task 3.3.1).
 * It simulates a scenario where the agent needs human approval before proceeding.
 *
 * Flow:
 * 1. Check if user's message contains 'interrupt' or 'approval' keywords
 * 2. If yes, call interrupt() to pause execution
 * 3. LangGraph will throw NodeInterrupt exception
 * 4. OrchestratorService should catch and return SUSPENDED status
 *
 * Usage in tests:
 * - Send message with 'interrupt' keyword
 * - Verify graph returns { status: 'SUSPENDED', threadId, interruptReason }
 * - Later: resume with POST /agents/resume
 */
export function hitlTestNode(state: CIOState): StateUpdate {
  const lastMessage = state.messages[state.messages.length - 1];
  const messageContent =
    typeof lastMessage.content === 'string'
      ? lastMessage.content.toLowerCase()
      : '';

  // Trigger interrupt if message contains HITL keywords
  const shouldInterrupt =
    messageContent.includes('interrupt') ||
    messageContent.includes('approval') ||
    messageContent.includes('hitl');

  if (shouldInterrupt) {
    // Log for debugging
    console.log('[HITL Test Node] Triggering interrupt for user approval');

    // Call interrupt() - this will throw NodeInterrupt exception
    // The exception should be caught by OrchestratorService
    interrupt(
      'This action requires human approval. Please review and confirm to continue.',
    );

    // Code after interrupt() will NOT execute
    // LangGraph stops execution here and saves state
  }

  // If no interrupt, proceed normally
  const responseMessage = new AIMessage(
    'HITL test node completed without interrupt',
  );

  return {
    messages: [responseMessage],
    nextAction: 'end',
  };
}
