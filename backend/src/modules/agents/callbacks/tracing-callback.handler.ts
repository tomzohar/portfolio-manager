import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { TracingService } from '../services/tracing.service';

/**
 * TracingCallbackHandler
 *
 * Automatic tracing middleware for LangGraph nodes.
 * Implements LangChain's BaseCallbackHandler to intercept:
 * - LLM streaming (token-by-token for real-time UX)
 * - Node execution (complete traces for debugging)
 *
 * Architecture:
 * - onLLMStart → emit 'llm.start' → Frontend shows "Thinking..."
 * - onLLMNewToken → emit 'llm.token' → Frontend appends character
 * - onLLMEnd → emit 'llm.complete' + save to DB
 * - onChainEnd → emit 'node.complete' + save complete trace
 *
 * Benefits:
 * - ChatGPT-style streaming UX (Level 3)
 * - Automatic tracing for all nodes
 * - No code changes in individual nodes
 * - Database persistence for history
 */
export class TracingCallbackHandler extends BaseCallbackHandler {
  name = 'TracingCallbackHandler';
  private readonly logger = new Logger(TracingCallbackHandler.name);
  private currentNodeInput: Record<string, unknown> = {};
  private currentNodeName = 'unknown';
  private currentLLMOutput = '';

  constructor(
    private readonly threadId: string,
    private readonly userId: string,
    private readonly tracingService: TracingService | null,
    private readonly eventEmitter: EventEmitter2 | null,
  ) {
    super();
  }

  /**
   * Called when LLM starts generating
   * Emits 'llm.start' event for frontend
   */
  handleLLMStart(): void {
    try {
      this.currentLLMOutput = '';
      if (this.eventEmitter) {
        this.eventEmitter.emit('llm.start', {
          threadId: this.threadId,
          userId: this.userId,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error in handleLLMStart: ${errorMessage}`);
    }
  }

  /**
   * Called for each token during LLM generation
   * Emits 'llm.token' event for real-time streaming
   */
  handleLLMNewToken(token: string): void {
    try {
      this.currentLLMOutput += token;
      if (this.eventEmitter) {
        this.eventEmitter.emit('llm.token', {
          threadId: this.threadId,
          userId: this.userId,
          token,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error in handleLLMNewToken: ${errorMessage}`);
    }
  }

  /**
   * Called when LLM completes generation
   * Emits 'llm.complete' event with full reasoning
   * Note: Database save happens in onChainEnd for complete context
   */
  handleLLMEnd(output: {
    generations?: Array<Array<{ text?: string }>>;
  }): void {
    try {
      const reasoning: string =
        output?.generations?.[0]?.[0]?.text || this.currentLLMOutput;

      if (this.eventEmitter) {
        this.eventEmitter.emit('llm.complete', {
          threadId: this.threadId,
          userId: this.userId,
          reasoning,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error in handleLLMEnd: ${errorMessage}`);
    }
  }

  /**
   * Called when a chain/node starts execution
   * Stores input for later use in onChainEnd
   * Also captures tags which may contain the node name
   */
  handleChainStart(
    chain: unknown,
    inputs: Record<string, unknown>,
    _runId?: string,
    _parentRunId?: string,
    tags?: string[],
    _metadata?: Record<string, unknown>,
    _runType?: string,
    name?: string,
  ): void {
    try {
      this.currentNodeInput = inputs;
      // Filter out LangGraph internal operations
      if (name && !this.shouldSkipTrace(name)) {
        this.currentNodeName = name;
        this.logger.debug(`Tracking node: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error in handleChainStart: ${errorMessage}`);
    }
  }

  /**
   * Called when a chain/node completes execution
   * Saves complete trace to database and emits 'node.complete' event
   */
  async handleChainEnd(
    outputs: Record<string, unknown> & { reasoning?: string },
    _runId?: string,
    _parentRunId?: string,
    tags?: string[],
    kwargs?: {
      inputs?: Record<string, unknown>;
      metadata?: { nodeName?: string; name?: string };
    },
    name?: string,
  ): Promise<void> {
    try {
      // Determine the node name
      let nodeName = this.currentNodeName;

      // Check kwargs metadata
      if (kwargs?.metadata?.nodeName) {
        nodeName = kwargs.metadata.nodeName;
      } else if (kwargs?.metadata?.name) {
        nodeName = kwargs.metadata.name;
      } else if (name) {
        nodeName = name;
      }

      // Only save traces for actual nodes, not internal LangGraph operations
      if (this.shouldSkipTrace(nodeName)) {
        return; // Skip internal operations
      }

      const reasoning: string =
        outputs?.reasoning || this.currentLLMOutput || '';

      // Save to database (async, non-blocking)
      if (this.tracingService) {
        try {
          await this.tracingService.recordTrace(
            this.threadId,
            this.userId,
            nodeName,
            this.currentNodeInput,
            outputs,
            reasoning,
          );
          this.logger.debug(`Recorded trace for node: ${nodeName}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to record trace for node ${nodeName}: ${errorMessage}`,
          );
        }
      }

      // Emit node completion event
      if (this.eventEmitter) {
        try {
          this.eventEmitter.emit('node.complete', {
            threadId: this.threadId,
            userId: this.userId,
            nodeName,
            timestamp: new Date(),
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Error emitting node.complete event: ${errorMessage}`,
          );
        }
      }

      // Reset for next node
      this.currentNodeName = 'unknown';
      this.currentLLMOutput = '';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error in handleChainEnd: ${errorMessage}`);
    }
  }

  private shouldSkipTrace(nodeName: string): boolean {
    // LangGraph creates multiple chains for internal operations (ChannelWrite, Branch, etc.)
    // We only want to track actual node executions
    // Node names come through the 'name' parameter as plain strings like 'guardrail', 'observer', 'end'
    const keywords = ['unknown', '__start__', '__end__', 'LangGraph'];
    const channels = ['ChannelWrite', 'Branch<', 'branch:to:'];
    return (
      keywords.includes(nodeName) ||
      channels.some((channel) => nodeName.startsWith(channel))
    );
  }
}
