import { AIMessage } from '@langchain/core/messages';
import { CIOState } from '../types';
import { requiresApproval } from './approval-gate.node';
import { Logger } from '@nestjs/common';

const routerLogger = new Logger('Router');

/**
 * Type for Gemini content parts
 */
type ContentPart = {
  type: string;
  text?: string;
  functionCall?: unknown;
};

/**
 * Router node that determines which path the graph should take
 * based on STRUCTURAL properties, not content analysis.
 *
 * Content-based routing (greetings vs analysis) is now handled by the LLM
 * via prompt engineering in the reasoning node.
 *
 * Routes to:
 * - 'tool_execution' if last message has tool_calls (ReAct pattern)
 * - 'reasoning' if last message is ToolMessage (for observation/synthesis)
 * - 'approval_gate' if query requires human approval (transactions, rebalancing)
 * - 'hitl_test' if query contains HITL test keywords (for testing only)
 * - 'performance_attribution' if query is about performance/returns/alpha
 * - 'reasoning' for all other human queries (default route - LLM decides tool usage)
 */
export function routerNode(state: CIOState): string {
  // Safety check: ensure messages array exists and has content
  if (!state.messages || state.messages.length === 0) {
    return 'reasoning'; // Default route to reasoning
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage) {
    return 'reasoning'; // Default route to reasoning
  }

  // Check if last message has tool calls (structural check instead of strict instanceof)
  const potentialAIMessage = lastMessage as AIMessage;

  if (
    potentialAIMessage.tool_calls &&
    Array.isArray(potentialAIMessage.tool_calls) &&
    potentialAIMessage.tool_calls.length > 0
  ) {
    return 'tool_execution';
  }

  // If we just executed tools (last message is ToolMessage), route back to reasoning
  // for observation and synthesis
  if (lastMessage.type === 'tool') {
    return 'reasoning';
  }

  // If no content in the message, use default routing
  if (!lastMessage.content) {
    return 'reasoning'; // Default route to reasoning
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

  // Performance attribution has complex specialized logic - keep as dedicated node
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

  // Default: Route all user queries to reasoning
  // The LLM will decide if it needs tools or can respond directly
  // based on prompt guidance (greetings, help, analysis, etc.)
  return 'reasoning';
}

/**
 * Reasoning router that determines next action after reasoning node
 *
 * Simpler routing logic specifically for reasoning node:
 * - Routes to 'tool_execution' if AIMessage contains tool_calls
 * - Routes to 'end' otherwise (reasoning complete)
 *
 * @param state - Current CIO state
 * @returns Either 'tool_execution' or 'end'
 */
export function reasoningRouter(state: CIOState): string {
  // Safety check
  if (!state.messages || state.messages.length === 0) {
    return 'end';
  }

  const lastMessage = state.messages[state.messages.length - 1];
  const messageType = lastMessage?.type;

  routerLogger.debug(`Reasoning router | Message type: ${messageType}`);

  // Check if last message has tool calls (standardized property or kwargs)
  // Use duck typing instead of strict instanceof to avoid issues with package versions or compilation
  const aiMessage = lastMessage as AIMessage;

  if (
    lastMessage.constructor.name === 'AIMessage' ||
    lastMessage.type === 'ai'
  ) {
    // Try direct property first
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      routerLogger.debug(
        `Routing to tool_execution | Tool calls: ${aiMessage.tool_calls.length}`,
      );
      return 'tool_execution';
    }
  }

  // Check if content is array with functionCall parts (Gemini format)
  if (Array.isArray(lastMessage?.content)) {
    const hasFunctionCall = lastMessage.content.some(
      (part: ContentPart) => part.type === 'functionCall',
    );
    if (hasFunctionCall) {
      routerLogger.debug(
        'Routing to tool_execution | Gemini functionCall detected',
      );
      return 'tool_execution';
    }
  }

  // No tool calls - reasoning is complete
  routerLogger.debug('Routing to end | No tool calls detected');
  return 'end';
}

/**
 * Tool execution router that determines next action after tool execution
 *
 * After tools are executed, we need to route back to reasoning for observation
 * and synthesis, or to end if there's an error.
 *
 * @param state - Current CIO state
 * @returns Either 'reasoning' (for observation) or 'end' (on error)
 */
export function toolExecutionRouter(state: CIOState): string {
  // Check for errors - if tools failed catastrophically, end execution
  if (state.errors && state.errors.length > 0) {
    const lastError = state.errors[state.errors.length - 1];
    if (lastError?.includes('ToolRegistry not available')) {
      return 'end';
    }
  }

  // Default: Route back to reasoning for observation and synthesis
  return 'reasoning';
}
