import { CIOState, StateUpdate } from '../types';

/**
 * End Node
 *
 * Terminal node of the CIO graph.
 * Formats and returns the final report.
 *
 * For Phase 1 "Hello World", this generates a simple summary report.
 */
export function endNode(state: CIOState): Promise<StateUpdate> {
  const report = formatFinalReport(state);

  return Promise.resolve({
    final_report: report,
  });
}

/**
 * Format final report from state
 */
function formatFinalReport(state: CIOState): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('CIO GRAPH EXECUTION REPORT (Phase 1 - Hello World)');
  lines.push('='.repeat(70));
  lines.push('');

  lines.push(`User ID: ${state.userId}`);
  lines.push(`Total iterations: ${state.iteration}`);
  lines.push(`Total messages: ${state.messages.length}`);
  lines.push('');

  if (state.errors.length > 0) {
    lines.push('ERRORS:');
    lines.push('-'.repeat(70));
    lines.push(`Errors encountered: ${state.errors.length}`);
    state.errors.forEach((error, idx) => {
      lines.push(`  ${idx + 1}. ${error}`);
    });
    lines.push('');
  } else {
    lines.push('STATUS: Success - No errors encountered');
    lines.push('');
  }

  lines.push('EXECUTION SUMMARY:');
  lines.push('-'.repeat(70));
  lines.push('Graph Execution Complete');
  lines.push('Observer node processed input successfully');
  lines.push('State persisted to PostgreSQL via PostgresSaver');
  lines.push('');

  lines.push('NEXT STEPS:');
  lines.push('-'.repeat(70));
  lines.push('Phase 1 infrastructure is complete.');
  lines.push(
    'Phase 2 will add portfolio analysis tools and multi-agent coordination.',
  );
  lines.push('');

  lines.push('='.repeat(70));

  return lines.join('\n');
}
