import { Logger } from '@nestjs/common';
import { CIOState, StateUpdate } from '../types';
import { TracingService } from '../../services/tracing.service';

/**
 * Node function type
 * Accepts state and optional config, returns state update
 */
type NodeFunction = (
  state: CIOState,
  config?: unknown,
  tracingService?: TracingService,
) => Promise<StateUpdate>;

/**
 * withTracing() - Higher-Order Function for Custom Node Reasoning
 *
 * Wraps a node function to add automatic tracing with custom reasoning messages.
 * This is OPTIONAL - nodes get automatic tracing via TracingCallbackHandler.
 * Use withTracing() only when you want to customize the reasoning message.
 *
 * Architecture Decision:
 * - TracingCallbackHandler: Automatic tracing for ALL nodes (preferred)
 * - withTracing(): Explicit opt-in for custom reasoning (use sparingly)
 *
 * Usage:
 * ```typescript
 * export const performanceNode = withTracing('performance_attribution', async (state) => {
 *   return {
 *     alpha: -0.06,
 *     reasoning: 'Portfolio underperformed due to tech overweight'
 *   };
 * });
 * ```
 *
 * @param nodeName - Name of the node (for tracing identification)
 * @param nodeFunction - Original node function to wrap
 * @returns Wrapped function with automatic tracing
 */
export function withTracing(
  nodeName: string,
  nodeFunction: NodeFunction,
): NodeFunction {
  const logger = new Logger(`withTracing:${nodeName}`);

  return async (
    state: CIOState,
    config?: unknown,
    tracingService?: TracingService,
  ): Promise<StateUpdate> => {
    // Execute original node function
    const result: StateUpdate = await nodeFunction(
      state,
      config,
      tracingService,
    );

    // If tracingService is provided, record the trace
    if (tracingService) {
      try {
        // Extract reasoning from result or use default
        const reasoning: string =
          (result as StateUpdate & { reasoning?: string })?.reasoning ||
          `Executed node: ${nodeName}`;

        // Record trace asynchronously (don't block node execution)
        await tracingService.recordTrace(
          state.threadId,
          state.userId,
          nodeName,
          state,
          result,
          reasoning,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        // Log error but don't fail the node execution
        logger.warn(
          `Failed to record trace for node ${nodeName}: ${errorMessage}`,
        );
      }
    }

    return result;
  };
}
