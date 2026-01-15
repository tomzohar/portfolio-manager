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
   */
  handleChainStart(_chain: unknown, inputs: Record<string, unknown>): void {
    try {
      this.currentNodeInput = inputs;
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
    _tags?: string[],
    kwargs?: {
      inputs?: Record<string, unknown>;
      metadata?: { nodeName?: string };
    },
  ): Promise<void> {
    try {
      const nodeName: string = kwargs?.metadata?.nodeName || 'unknown';
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
        this.eventEmitter.emit('node.complete', {
          threadId: this.threadId,
          userId: this.userId,
          nodeName,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error in handleChainEnd: ${errorMessage}`);
    }
  }
}
