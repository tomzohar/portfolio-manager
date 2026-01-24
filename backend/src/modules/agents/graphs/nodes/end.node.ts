import { CIOState, StateUpdate } from '../types';

/**
 * End Node
 *
 * Terminal node of the CIO graph.
 * Extracts the final AI response and formats it as the report.
 *
 * The final report is taken from the last AIMessage in the conversation,
 * which contains the LLM's synthesized response (potentially after tool usage).
 */
export function endNode(state: CIOState): Promise<StateUpdate> {
  const report = extractFinalReport(state);

  return Promise.resolve({
    final_report: report,
  });
}

/**
 * Extract final report from the last AI message
 *
 * @param state - Current CIO state
 * @returns Final report string
 */
function extractFinalReport(state: CIOState): string {
  // Find the last AI message in the conversation
  const aiMessages = state.messages.filter((msg) => msg._getType() === 'ai');

  if (aiMessages.length === 0) {
    // Fallback: No AI messages found
    return generateFallbackReport(state);
  }

  const lastAiMessage = aiMessages[aiMessages.length - 1];
  if (!lastAiMessage) {
    return generateFallbackReport(state);
  }

  const content = lastAiMessage.content;
  const reportText =
    typeof content === 'string' ? content : JSON.stringify(content);

  // If the report is empty or very short, provide a better fallback
  if (!reportText || reportText.trim().length < 10) {
    return generateFallbackReport(state);
  }

  return reportText;
}

/**
 * Generate fallback report when no AI response is available
 *
 * @param state - Current CIO state
 * @returns Fallback report string
 */
function generateFallbackReport(state: CIOState): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('CIO GRAPH EXECUTION REPORT');
  lines.push('='.repeat(70));
  lines.push('');

  lines.push(`User ID: ${state.userId}`);
  lines.push(`Total iterations: ${state.iteration}`);
  lines.push(`Total messages: ${state.messages.length}`);
  lines.push('');

  if (state.errors.length > 0) {
    lines.push('ERRORS:');
    lines.push('-'.repeat(70));
    state.errors.forEach((error, idx) => {
      lines.push(`  ${idx + 1}. ${error}`);
    });
    lines.push('');
  }

  lines.push('EXECUTION SUMMARY:');
  lines.push('-'.repeat(70));
  lines.push('Graph Execution Complete');
  lines.push(
    'No AI response generated - this may indicate an error or early termination',
  );
  lines.push('');

  lines.push('='.repeat(70));

  return lines.join('\n');
}
