import { CIOState } from '../types';
import { requiresApproval } from './approval-gate.node';
import { AIMessage } from '@langchain/core/messages';
import { Logger } from '@nestjs/common';

const routerLogger = new Logger('Router');

/**
 * Type definition for tool calls structure
 */
type ToolCallStructure = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  type?: string;
};

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
 * based on the user's query content and current state
 *
 * Routes to:
 * - 'tool_execution' if last message has tool_calls (ReAct pattern)
 * - 'approval_gate' if query requires human approval (transactions, rebalancing, high-risk actions)
 * - 'hitl_test' if query contains HITL test keywords (for testing only)
 * - 'performance_attribution' if query is about performance/returns/alpha
 * - 'reasoning' for general queries requiring LLM analysis (market outlook, analysis, etc.)
 * - 'observer' for simple queries
 * - 'end' to terminate execution
 */
export function routerNode(state: CIOState): string {
  // Safety check: ensure messages array exists and has content
  if (!state.messages || state.messages.length === 0) {
    return 'observer'; // Default route if no messages
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage) {
    return 'observer'; // Default route if no last message
  }

  // Check if last message has tool calls (from reasoning node)
  // tool_calls property only exists on AIMessage
  if (lastMessage instanceof AIMessage) {
    const aiMessage = lastMessage as AIMessage & { tool_calls?: unknown[] };
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      return 'tool_execution';
    }
  }

  // Fallback: Check additional_kwargs for non-standard format
  if (
    lastMessage.additional_kwargs?.tool_calls &&
    lastMessage.additional_kwargs.tool_calls.length > 0
  ) {
    return 'tool_execution';
  }

  // If we just executed tools (last message is ToolMessage), route back to reasoning
  // for observation and synthesis
  if (lastMessage._getType() === 'tool') {
    return 'reasoning';
  }

  // If no content in the message, use default routing
  if (!lastMessage.content) {
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
  const messageType = lastMessage?._getType();

  routerLogger.debug(`Reasoning router | Message type: ${messageType}`);

  // Check if last message has tool calls (standardized property or kwargs)
  if (lastMessage instanceof AIMessage) {
    // Type assertion for accessing tool_calls property
    const aiMessage = lastMessage as AIMessage & {
      tool_calls?: ToolCallStructure[];
      kwargs?: {
        tool_calls?: ToolCallStructure[];
      };
    };

    // Try direct property first
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      routerLogger.debug(
        `Routing to tool_execution | Tool calls: ${aiMessage.tool_calls.length}`,
      );
      return 'tool_execution';
    }

    // Fallback to kwargs (for checkpointed messages)
    if (
      aiMessage.kwargs?.tool_calls &&
      aiMessage.kwargs.tool_calls.length > 0
    ) {
      routerLogger.debug(
        `Routing to tool_execution | Tool calls (kwargs): ${aiMessage.kwargs.tool_calls.length}`,
      );
      return 'tool_execution';
    }
  }

  // Fallback: Check additional_kwargs for non-standard format
  if (
    lastMessage?.additional_kwargs?.tool_calls &&
    lastMessage.additional_kwargs.tool_calls.length > 0
  ) {
    routerLogger.debug(
      `Routing to tool_execution | Tool calls (additional_kwargs): ${lastMessage.additional_kwargs.tool_calls.length}`,
    );
    return 'tool_execution';
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
