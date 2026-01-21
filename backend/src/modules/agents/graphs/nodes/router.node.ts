import { CIOState } from '../types';
import { requiresApproval } from './approval-gate.node';

/**
 * Router node that determines which path the graph should take
 * based on the user's query content
 *
 * Routes to:
 * - 'approval_gate' if query requires human approval (transactions, rebalancing, high-risk actions)
 * - 'hitl_test' if query contains HITL test keywords (for testing only)
 * - 'performance_attribution' if query is about performance/returns/alpha
 * - 'reasoning' for general queries requiring LLM analysis (market outlook, analysis, etc.)
 * - 'observer' for simple queries
 */
export function routerNode(state: CIOState): string {
  // Safety check: ensure messages array exists and has content
  if (!state.messages || state.messages.length === 0) {
    return 'observer'; // Default route if no messages
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || !lastMessage.content) {
    return 'observer'; // Default route if no content
  }

  const messageContent = lastMessage.content;
  const content = (
    typeof messageContent === 'string'
      ? messageContent
      : JSON.stringify(messageContent)
  ).toLowerCase();

  // Check for approval gate scenarios (only if enabled via environment variable)
  // Delegate approval logic to approval gate module
  const enableApprovalGate = process.env.ENABLE_APPROVAL_GATE === 'true';
  if (enableApprovalGate && requiresApproval(content)) {
    return 'approval_gate';
  }

  // Check for HITL test keywords (only if enabled via environment variable)
  const enableHitlTest = process.env.ENABLE_HITL_TEST_NODE === 'true';
  if (
    enableHitlTest &&
    (content.includes('interrupt') ||
      content.includes('approval') ||
      content.includes('hitl'))
  ) {
    return 'hitl_test';
  }

  // Check if query is about performance
  if (
    content.includes('performance') ||
    content.includes('perform') ||
    content.includes('return') ||
    content.includes('alpha') ||
    content.includes('ytd') ||
    content.includes('year to date') ||
    content.includes('beat') ||
    content.includes('outperform') ||
    content.includes('underperform')
  ) {
    return 'performance_attribution';
  }

  // Route to reasoning node for queries requiring LLM analysis
  // These keywords indicate the user wants detailed, thoughtful analysis
  if (
    content.includes('analysis') ||
    content.includes('analyze') ||
    content.includes('market') ||
    content.includes('outlook') ||
    content.includes('sector') ||
    content.includes('technology') ||
    content.includes('financial') ||
    content.includes('tech stocks') ||
    content.includes('detail') ||
    content.includes('insights') ||
    content.includes('sentiment') ||
    content.includes('provide') ||
    content.includes('explain')
  ) {
    return 'reasoning';
  }

  return 'observer';
}
