import { CIOState } from '../types';

/**
 * Router node that determines which path the graph should take
 * based on the user's query content
 *
 * Routes to:
 * - 'performance_attribution' if query is about performance/returns/alpha
 * - 'observer' for all other queries
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

  return 'observer';
}
