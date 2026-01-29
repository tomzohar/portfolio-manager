import { RunnableConfig } from '@langchain/core/runnables';
import { ToolMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { CIOState, StateUpdate } from '../types';
import { Logger } from '@nestjs/common';

const toolExecutionLogger = new Logger('ToolExecution');

/**
 * Standardized tool call structure used internally
 */
export type ToolCallStructure = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  type?: string;
};

/**
 * Extended AIMessage type with tool_calls and kwargs properties
 */
type AIMessageWithToolCalls = AIMessage & {
  tool_calls?: ToolCallStructure[];
  kwargs?: {
    tool_calls?: ToolCallStructure[];
  };
};

/**
 * OpenAI-style tool call format in additional_kwargs
 */
type OpenAIToolCall = {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
};

/**
 * Gemini content part with functionCall
 */
type GeminiContentPart = {
  type: string;
  functionCall?: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
  };
};

/**
 * Tool registry interface
 */
interface ToolRegistry {
  getTool: (name: string) => {
    invoke: (args: Record<string, unknown>) => Promise<unknown>;
  } | null;
}

/**
 * Tool execution result
 */
type ToolExecutionResult = {
  message: ToolMessage;
  success: boolean;
  duration: number;
};

/**
 * Extract tool calls from AIMessage standard property
 */
function extractStandardToolCalls(
  message: BaseMessage,
): ToolCallStructure[] | null {
  if (!(message instanceof AIMessage)) {
    return null;
  }

  const aiMessage = message as AIMessageWithToolCalls;
  if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
    toolExecutionLogger.debug(
      `Detected ${aiMessage.tool_calls.length} tool call(s) via standard property: [${aiMessage.tool_calls.map((tc) => tc.name).join(', ')}]`,
    );
    return aiMessage.tool_calls;
  }

  return null;
}

/**
 * Extract tool calls from AIMessage kwargs (checkpointed messages)
 */
function extractKwargsToolCalls(
  message: BaseMessage,
): ToolCallStructure[] | null {
  if (!(message instanceof AIMessage)) {
    return null;
  }

  const aiMessage = message as AIMessageWithToolCalls;
  if (aiMessage.kwargs?.tool_calls && aiMessage.kwargs.tool_calls.length > 0) {
    toolExecutionLogger.debug(
      `Detected ${aiMessage.kwargs.tool_calls.length} tool call(s) in kwargs (checkpointed): [${aiMessage.kwargs.tool_calls.map((tc) => tc.name).join(', ')}]`,
    );
    return aiMessage.kwargs.tool_calls;
  }

  return null;
}

/**
 * Parse and normalize OpenAI-style tool calls from additional_kwargs
 */
function parseOpenAIToolCalls(rawToolCall: OpenAIToolCall): ToolCallStructure {
  try {
    return {
      id: rawToolCall.id,
      name: rawToolCall.function.name,
      args: JSON.parse(rawToolCall.function.arguments) as Record<
        string,
        unknown
      >,
      type: rawToolCall.type,
    };
  } catch {
    // Return error marker in args if JSON parsing fails
    return {
      id: rawToolCall.id,
      name: rawToolCall.function.name,
      args: { __parse_error: 'Invalid JSON in arguments' },
      type: rawToolCall.type,
    };
  }
}

/**
 * Extract tool calls from additional_kwargs (OpenAI format)
 */
function extractAdditionalKwargsToolCalls(
  message: BaseMessage,
): ToolCallStructure[] | null {
  if (!message.additional_kwargs?.tool_calls) {
    return null;
  }

  const rawToolCalls = message.additional_kwargs.tool_calls as OpenAIToolCall[];
  const toolCalls = rawToolCalls.map(parseOpenAIToolCalls);

  if (toolCalls.length > 0) {
    toolExecutionLogger.debug(
      `Detected ${toolCalls.length} tool call(s) in additional_kwargs: [${toolCalls.map((tc) => tc.name).join(', ')}]`,
    );
  }

  return toolCalls;
}

/**
 * Generate unique ID for Gemini function calls
 */
function generateGeminiToolCallId(): string {
  return `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract tool calls from Gemini content array format
 */
function extractGeminiToolCalls(
  message: BaseMessage,
): ToolCallStructure[] | null {
  if (!Array.isArray(message.content)) {
    return null;
  }

  const toolCalls: ToolCallStructure[] = [];

  for (const part of message.content as GeminiContentPart[]) {
    if (part.type === 'functionCall' && part.functionCall) {
      toolCalls.push({
        id: part.functionCall.id || generateGeminiToolCallId(),
        name: part.functionCall.name,
        args: part.functionCall.args || {},
        type: 'function',
      });
    }
  }

  if (toolCalls.length > 0) {
    toolExecutionLogger.debug(
      `Detected ${toolCalls.length} tool call(s) in Gemini content array: [${toolCalls.map((tc) => tc.name).join(', ')}]`,
    );
  }

  return toolCalls.length > 0 ? toolCalls : null;
}

/**
 * Extract tool calls from message using all available formats
 * Tries formats in order of preference: standard -> kwargs -> additional_kwargs -> Gemini
 */
function extractToolCalls(
  message: BaseMessage | undefined,
): ToolCallStructure[] {
  if (!message) {
    return [];
  }

  // Try standard property first
  const standardCalls = extractStandardToolCalls(message);
  if (standardCalls) return standardCalls;

  // Try kwargs (checkpointed messages)
  const kwargsCalls = extractKwargsToolCalls(message);
  if (kwargsCalls) return kwargsCalls;

  // Try additional_kwargs (OpenAI format)
  const additionalKwargsCalls = extractAdditionalKwargsToolCalls(message);
  if (additionalKwargsCalls) return additionalKwargsCalls;

  // Try Gemini content array format
  const geminiCalls = extractGeminiToolCalls(message);
  if (geminiCalls) return geminiCalls;

  return [];
}

/**
 * Validate tool registry exists in config
 */
function validateToolRegistry(
  config: RunnableConfig,
): ToolRegistry | StateUpdate {
  const toolRegistry = config.configurable?.toolRegistry as
    | ToolRegistry
    | undefined;

  if (!toolRegistry) {
    toolExecutionLogger.error(
      'ToolRegistry not available in config - cannot execute tools',
    );
    return {
      errors: ['ToolRegistry not available in config'],
    };
  }

  return toolRegistry;
}

/**
 * Create error ToolMessage for tool not found
 */
function createToolNotFoundMessage(toolCall: ToolCallStructure): ToolMessage {
  toolExecutionLogger.warn(`Tool '${toolCall.name}' not found in registry`);
  return new ToolMessage({
    content: JSON.stringify({
      error: `Tool '${toolCall.name}' not found in registry`,
    }),
    tool_call_id: toolCall.id || 'unknown',
    name: toolCall.name,
  });
}

function createInvalidArgsMessage(toolCall: ToolCallStructure): ToolMessage {
  const errorValue = toolCall.args.__parse_error;
  const parseError =
    typeof errorValue === 'string' ? errorValue : 'Invalid JSON in arguments';
  toolExecutionLogger.warn(`Tool '${toolCall.name}' has invalid arguments`);
  return new ToolMessage({
    content: JSON.stringify({
      error: `Failed to parse tool arguments: ${parseError}`,
    }),
    tool_call_id: toolCall.id || 'unknown',
    name: toolCall.name,
  });
}

/**
 * Format tool result as string for ToolMessage
 */
function formatToolResult(result: unknown): string {
  return typeof result === 'string' ? result : JSON.stringify(result);
}

function createSuccessMessage(
  toolCall: ToolCallStructure,
  result: unknown,
  duration: number,
): ToolMessage {
  const resultPreview = formatToolResult(result).substring(0, 100);
  toolExecutionLogger.debug(
    `✓ ${toolCall.name} completed in ${duration}ms | Result: ${resultPreview}...`,
  );

  return new ToolMessage({
    content: formatToolResult(result),
    tool_call_id: toolCall.id || 'unknown',
    name: toolCall.name,
  });
}

function createErrorMessage(
  toolCall: ToolCallStructure,
  error: unknown,
  duration: number,
): ToolMessage {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  toolExecutionLogger.error(
    `✗ ${toolCall.name} failed after ${duration}ms: ${errorMessage}`,
  );

  return new ToolMessage({
    content: JSON.stringify({
      error: `Tool execution failed: ${errorMessage}`,
    }),
    tool_call_id: toolCall.id || 'unknown',
    name: toolCall.name,
  });
}

import { EarningsCalendarResult } from '../../tools/earnings-calendar.tool';

/**
 * Check for imminent earnings risk for technical/fundamental analysis tools
 */
async function checkEarningsRisk(
  toolCall: ToolCallStructure,
  toolRegistry: ToolRegistry,
): Promise<string | null> {
  const monitoredTools = ['technical_analyst', 'fundamental_analyst'];
  if (!monitoredTools.includes(toolCall.name)) {
    return null;
  }

  // Extract ticker from various possible arg names
  const ticker = (toolCall.args.ticker ||
    toolCall.args.symbol ||
    toolCall.args.stock) as string;

  if (!ticker || typeof ticker !== 'string') {
    return null;
  }

  try {
    const earningsTool = toolRegistry.getTool('earnings_calendar');
    if (!earningsTool) {
      return null;
    }

    // Check earnings for the next 7 days
    const resultStr = (await earningsTool.invoke({
      symbol: ticker,
      days_ahead: 7,
    })) as string;

    const result = JSON.parse(resultStr) as EarningsCalendarResult;

    if (result.upcoming_earnings && result.upcoming_earnings.length > 0) {
      const next = result.upcoming_earnings[0];
      return (
        `\n\n> [!CAUTION]\n` +
        `> **PROACTIVE RISK WARNING**: ${ticker} has an upcoming earnings report on **${next.date}** (${next.hour}).\n` +
        `> This tool result may be impacted by extreme volatility or fundamental shifts following the report.`
      );
    }
  } catch (error) {
    toolExecutionLogger.debug(
      `Failed to perform proactive earnings check for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  return null;
}

/**
 * Execute a single tool call
 */
async function executeSingleTool(
  toolCall: ToolCallStructure,
  toolRegistry: ToolRegistry,
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // Get tool from registry
    const tool = toolRegistry.getTool(toolCall.name);
    if (!tool) {
      return {
        message: createToolNotFoundMessage(toolCall),
        success: false,
        duration: Date.now() - startTime,
      };
    }

    // Check for parse errors
    if ('__parse_error' in toolCall.args) {
      return {
        message: createInvalidArgsMessage(toolCall),
        success: false,
        duration: Date.now() - startTime,
      };
    }

    // Execute tool
    toolExecutionLogger.debug(
      `Invoking ${toolCall.name}(${JSON.stringify(toolCall.args).substring(0, 100)}...)`,
    );
    const result = await tool.invoke(toolCall.args);
    const duration = Date.now() - startTime;

    return {
      message: createSuccessMessage(toolCall, result, duration),
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      message: createErrorMessage(toolCall, error, duration),
      success: false,
      duration,
    };
  }
}

/**
 * Execute multiple tool calls in parallel
 */
async function executeToolCalls(
  toolCalls: ToolCallStructure[],
  toolRegistry: ToolRegistry,
): Promise<ToolMessage[]> {
  toolExecutionLogger.log(
    `Executing ${toolCalls.length} tool(s): ${toolCalls.map((tc) => tc.name).join(', ')}`,
  );

  const startTime = Date.now();
  const results = await Promise.all(
    toolCalls.map((toolCall) => executeSingleTool(toolCall, toolRegistry)),
  );

  // Proactive check: Add earnings warnings to technical/fundamental analysis results
  await Promise.all(
    results.map(async (r, index) => {
      if (r.success) {
        const warning = await checkEarningsRisk(toolCalls[index], toolRegistry);
        if (warning) {
          // Append warning to the existing content
          const originalContent =
            typeof r.message.content === 'string'
              ? r.message.content
              : JSON.stringify(r.message.content);
          r.message.content = originalContent + warning;
        }
      }
    }),
  );

  const totalDuration = Date.now() - startTime;

  // Log summary
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  if (failureCount > 0) {
    toolExecutionLogger.warn(
      `Completed ${results.length} tool(s) in ${totalDuration}ms | ` +
        `Success: ${successCount}, Failed: ${failureCount}`,
    );
  } else {
    toolExecutionLogger.log(
      `✓ Successfully executed ${results.length} tool(s) in ${totalDuration}ms`,
    );
  }

  return results.map((r) => r.message);
}

/**
 * Tool Execution Node
 *
 * Executes tools requested by the LLM during the reasoning phase.
 * This node is part of the ReAct (Reasoning-Action-Observation) pattern.
 *
 * Flow:
 * 1. Extract tool calls from the last AIMessage
 * 2. Execute each tool with provided arguments
 * 3. Return ToolMessages with results
 * 4. Router sends back to reasoning node for observation and synthesis
 *
 * Key Features:
 * - Executes multiple tool calls in parallel for efficiency
 * - Handles tool execution errors gracefully
 * - Returns ToolMessages that LLM can observe and reason about
 */
export async function toolExecutionNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  const hasRegistry = !!config.configurable?.toolRegistry;
  const lastMessage = state.messages[state.messages.length - 1];
  const messageType = lastMessage?._getType();

  toolExecutionLogger.debug(
    `Node started | Registry: ${hasRegistry ? '✓' : '✗'} | Message type: ${messageType}`,
  );

  // Extract tool calls from message
  const toolCalls = extractToolCalls(lastMessage);

  if (toolCalls.length === 0) {
    toolExecutionLogger.debug(
      'No tool calls detected in message, returning empty update',
    );
    return {};
  }

  // Validate tool registry
  const toolRegistryOrError = validateToolRegistry(config);
  if ('errors' in toolRegistryOrError) {
    return toolRegistryOrError; // Return error state
  }

  // Execute tools
  const toolMessages = await executeToolCalls(
    toolCalls,
    toolRegistryOrError as ToolRegistry,
  );

  return {
    messages: toolMessages,
  };
}
