import { AIMessage } from '@langchain/core/messages';
import { CIOState, StateUpdate } from '../types';
import { Logger } from '@nestjs/common';

const logger = new Logger('ErrorNode');

/**
 * Error Handling Node
 *
 * Catches failures from other nodes (reasoning, tool_execution) and
 * generates a user-friendly error response. This prevents the agent
 * from crashing or hanging when technical issues occur.
 */
export function errorNode(state: CIOState): Promise<StateUpdate> {
  logger.warn(`Entering ErrorNode. Current errors: ${state.errors.join(', ')}`);

  // Default error message
  let userMessage =
    'I apologize, but I encountered a temporary technical issue while processing your request. Please try again in a moment.';

  // Tailor message based on error type if possible
  const lastError = state.errors[state.errors.length - 1];
  if (lastError) {
    if (lastError.includes('recursion limit')) {
      userMessage =
        'I apologize, but the analysis is more complex than expected. Could you try asking a more specific question regarding this ticker?';
    } else if (lastError.includes('ToolRegistry')) {
      userMessage =
        "I'm currently having trouble accessing my analysis tools. Please try again shortly.";
    }
  }

  // Create AIMessage with the error explanation
  const message = new AIMessage(userMessage);

  return Promise.resolve({
    // Append the apology message
    messages: [message],
    // We don't clear errors here to preserve history for debugging,
    // but in a real-world scenario you might want to 'consume' them
    // or set a flag that they are handled.
    nextAction: 'end',
  });
}
