import { RunnableConfig } from '@langchain/core/runnables';
import { ToolMessage } from '@langchain/core/messages';
import { CIOState, StateUpdate } from '../types';
import { Logger } from '@nestjs/common';

const toolExecutionLogger = new Logger('ToolExecution');

/**
 * Standardized tool call structure used internally
 */
import { extractToolCalls, ToolCallStructure } from '../../utils/message.utils';

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
import { PerformanceAttributionResult } from '../../tools/performance-attribution.tool';

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
  userId: string,
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

    // Inject system context (userId) if tool accepts it
    // We do this by creating a new args object
    const args = { ...toolCall.args, userId };

    // Execute tool
    toolExecutionLogger.debug(
      `Invoking ${toolCall.name}(${JSON.stringify(toolCall.args).substring(0, 100)}...)`,
    );
    const result = await tool.invoke(args);
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
  userId: string,
): Promise<ToolMessage[]> {
  toolExecutionLogger.log(
    `Executing ${toolCalls.length} tool(s): ${toolCalls.map((tc) => tc.name).join(', ')}`,
  );

  const startTime = Date.now();
  const results = await Promise.all(
    toolCalls.map((toolCall) =>
      executeSingleTool(toolCall, toolRegistry, userId),
    ),
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
    state.userId,
  );

  const stateUpdate: StateUpdate = {
    messages: toolMessages,
  };

  // Specialized State Updates: Extract structured data from tool outputs
  // This ensures E2E tests and potentially frontend can access structured results
  for (const msg of toolMessages) {
    if (msg.name === 'performance_attribution') {
      try {
        const result = JSON.parse(
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
        ) as PerformanceAttributionResult;

        stateUpdate.performanceAnalysis = {
          timeframe: result.timeframe,
          portfolioReturn: result.portfolioReturn,
          benchmarkReturn: result.benchmarkReturn,
          alpha: result.alpha,
          sectorBreakdown: result.sectorBreakdown,
          topPerformers: result.topPerformers,
          bottomPerformers: result.bottomPerformers,
        };
      } catch (error) {
        toolExecutionLogger.debug(
          `Failed to parse performance_attribution result for state update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  return stateUpdate;
}
