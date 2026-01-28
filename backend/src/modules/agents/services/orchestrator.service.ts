import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StateService } from './state.service';
import { ToolRegistryService } from './tool-registry.service';
import { CIOState, PortfolioData } from '../graphs/types';
import { PerformanceService } from '../../performance/performance.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { SectorAttributionService } from '../../performance/services/sector-attribution.service';
import {
  GraphExecutionConfig,
  GraphExecutionError,
} from './types/langgraph.types';
import { GraphExecutorService } from './graph-executor.service';
import { InterruptHandlerService } from './interrupt-handler.service';
import { GuardrailException } from '../graphs/nodes/guardrail.node';
import { TracingService } from './tracing.service';
import { TracingCallbackHandler } from '../callbacks/tracing-callback.handler';
import { CitationService } from '../../citations/services/citation.service';
import { ConversationService } from '../../conversations/services/conversation.service';
import { GeminiLlmService } from './gemini-llm.service';
import { getDefaultModel } from '../utils/model.utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface GraphInput {
  message: string;
  portfolio?: PortfolioData;
}

export interface GraphResult {
  threadId: string;
  finalState: CIOState;
  success: boolean;
  status: 'SUSPENDED' | 'COMPLETED' | 'FAILED';
  interruptReason?: string;
  error?: string;
  citationCount?: number;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_ITERATIONS = 10;
const RECURSION_LIMIT = 25;

/**
 * OrchestratorService
 *
 * Single Responsibility: Coordinate high-level graph execution workflows
 *
 * Responsibilities:
 * - Public API for graph operations (run, resume, stream)
 * - User validation and security checks
 * - Thread ID scoping and state initialization
 * - Event emission for UI updates
 * - Delegate execution to GraphExecutorService
 * - Delegate interrupt handling to InterruptHandlerService
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly stateService: StateService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly performanceService: PerformanceService,
    private readonly portfolioService: PortfolioService,
    private readonly sectorAttributionService: SectorAttributionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly graphExecutor: GraphExecutorService,
    private readonly interruptHandler: InterruptHandlerService,
    private readonly tracingService: TracingService,
    private readonly conversationService: ConversationService,
    private readonly geminiLlmService: GeminiLlmService,
    @Optional()
    @Inject(CitationService)
    private readonly citationService?: CitationService,
  ) { }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Run the CIO graph for a user
   *
   * @param userId - User ID (required for security)
   * @param input - Graph input (message, optional portfolio)
   * @param threadId - Optional thread ID for continuing conversations
   * @returns Graph execution result with status
   */
  async runGraph(
    userId: string,
    input: GraphInput,
    threadId?: string,
  ): Promise<GraphResult> {
    this.validateUserId(userId);
    this.logger.log(`Running graph for user ${userId}`);

    const scopedThreadId = this.getScopedThreadId(userId, threadId);
    const initialState = this.buildInitialState(userId, scopedThreadId, input);

    // Create assistant message placeholder before graph execution
    const assistantMessage =
      await this.conversationService.saveAssistantMessage({
        threadId: scopedThreadId,
        userId,
        content: '', // Will be updated after completion
        traceIds: [],
      });

    const config = this.buildGraphConfig(
      scopedThreadId,
      userId,
      input.portfolio?.id,
      assistantMessage.id, // Pass messageId to config
    );

    try {
      const finalState = await this.graphExecutor.invoke(initialState, config);

      // Check if execution was interrupted
      const interruptResult = this.interruptHandler.checkForInterrupt(
        finalState,
        scopedThreadId,
      );
      if (interruptResult) {
        return interruptResult;
      }

      // Normal completion
      return await this.buildCompletedResult(
        finalState,
        scopedThreadId,
        userId,
        assistantMessage.id,
      );
    } catch (error) {
      return this.handleGraphExecutionError(
        error,
        userId,
        scopedThreadId,
        initialState,
      );
    }
  }

  /**
   * Resume a suspended graph execution
   *
   * @param userId - User ID (required for security)
   * @param threadId - Scoped thread ID (userId:threadId format)
   * @param userInput - User's input to continue execution
   * @returns Graph execution result
   */
  async resumeGraph(
    userId: string,
    threadId: string,
    userInput: string,
  ): Promise<GraphResult> {
    this.validateUserId(userId, BadRequestException);
    this.validateThreadAccess(userId, threadId);

    this.logger.log(`Resuming graph for user ${userId}, thread ${threadId}`);

    const config = this.buildGraphConfig(threadId, userId);

    try {
      await this.validateThreadSuspended(config);

      // Add user input and resume
      await this.graphExecutor.addUserInput(config, userInput);
      const finalState = await this.graphExecutor.resume(config);

      if (!finalState.__interrupt__) {
        this.logger.warn(
          `Resume attempt on non-interrupted thread ${threadId}`,
        );
      }

      return await this.buildCompletedResult(
        finalState,
        threadId,
        userId,
        null,
      );
    } catch (error) {
      return this.handleResumeError(error, userId, threadId);
    }
  }

  /**
   * Stream graph execution (placeholder for future implementation)
   *
   * @param userId - User ID
   * @param input - Graph input
   * @param threadId - Optional thread ID
   * @yields Graph execution updates
   */
  async *streamGraph(
    userId: string,
    input: GraphInput,
    threadId?: string,
  ): AsyncGenerator<GraphResult, void, unknown> {
    this.validateUserId(userId);
    this.logger.warn('Streaming not yet implemented (Phase 2)');

    const result = await this.runGraph(userId, input, threadId);
    yield result;
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate userId is present and non-empty
   *
   * @param userId - User ID to validate
   * @param ExceptionClass - Exception to throw (default: Error)
   * @throws Error or custom exception if invalid
   */
  private validateUserId(
    userId: string,
    ExceptionClass: new (message: string) => Error = Error,
  ): void {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new ExceptionClass(
        'userId is required for all graph executions (security requirement)',
      );
    }
  }

  /**
   * Validate user has access to the thread
   *
   * @param userId - User ID
   * @param threadId - Scoped thread ID
   * @throws ForbiddenException if user doesn't own the thread
   */
  private validateThreadAccess(userId: string, threadId: string): void {
    const extractedUserId = this.stateService.extractUserId(threadId);
    if (!extractedUserId || extractedUserId !== userId) {
      throw new ForbiddenException(
        'Cannot access threads belonging to other users',
      );
    }
  }

  /**
   * Validate thread is in suspended state
   *
   * @param config - Graph configuration
   * @throws NotFoundException if thread doesn't exist
   * @throws BadRequestException if thread is not suspended
   */
  private async validateThreadSuspended(
    config: GraphExecutionConfig,
  ): Promise<void> {
    try {
      const currentState = await this.graphExecutor.getState(config);

      if (!currentState || !currentState.values) {
        throw new NotFoundException(
          'Thread not found. Please check the threadId.',
        );
      }

      const isSuspended = this.interruptHandler.isThreadSuspended(currentState);
      if (!isSuspended) {
        throw new BadRequestException(
          'Thread is not in suspended state. Cannot resume a completed thread.',
        );
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new NotFoundException(
        'Thread not found or checkpoint unavailable.',
      );
    }
  }

  // ============================================================================
  // State & Configuration Management
  // ============================================================================

  /**
   * Get scoped thread ID (userId:threadId format)
   *
   * @param userId - User ID
   * @param threadId - Optional existing thread ID
   * @returns Scoped thread ID
   */
  private getScopedThreadId(userId: string, threadId?: string): string {
    if (threadId && threadId.includes(':')) {
      this.logger.debug(`Using existing scoped thread ID: ${threadId}`);
      return threadId;
    }

    const scopedThreadId = this.stateService.scopeThreadId(userId, threadId);
    this.logger.debug(`Created new scoped thread ID: ${scopedThreadId}`);
    return scopedThreadId;
  }

  /**
   * Build initial graph state
   *
   * @param userId - User ID
   * @param threadId - Scoped thread ID
   * @param input - Graph input
   * @returns Initial CIO state
   */
  private buildInitialState(
    userId: string,
    threadId: string,
    input: GraphInput,
  ): CIOState {
    return {
      userId,
      threadId,
      messages: [new HumanMessage(input.message)],
      portfolio: input.portfolio,
      errors: [],
      iteration: 0,
      maxIterations: MAX_ITERATIONS,
    };
  }

  /**
   * Build graph execution configuration
   *
   * @param threadId - Scoped thread ID
   * @param userId - User ID for tracing
   * @param portfolioId - Optional portfolio ID for context storage (US-004)
   * @returns Graph configuration object with tracing callback, metadata, and tool registry
   */
  private buildGraphConfig(
    threadId: string,
    userId?: string,
    portfolioId?: string,
    messageId?: string,
  ): GraphExecutionConfig {
    const config: GraphExecutionConfig = {
      configurable: {
        thread_id: threadId,
        userId, // Add userId to configurable for tools to access
        toolRegistry: this.toolRegistry, // Provide tool registry for agentic tool calling
        performanceService: this.performanceService,
        portfolioService: this.portfolioService,
        sectorAttributionService: this.sectorAttributionService,
        geminiLlmService: this.geminiLlmService,
      },
      recursionLimit: RECURSION_LIMIT,
      metadata: {
        portfolioId: portfolioId || null,
      },
    };

    // Add automatic tracing callback if userId is provided
    if (userId) {
      const tracingCallback = new TracingCallbackHandler(
        threadId,
        userId,
        this.tracingService,
        this.eventEmitter,
        messageId, // Pass messageId to callback handler
      );
      config.callbacks = [tracingCallback];
    }

    return config;
  }

  // ============================================================================
  // Result Building
  // ============================================================================

  /**
   * Build completed graph result
   *
   * @param finalState - Final graph state
   * @param threadId - Scoped thread ID
   * @param userId - User ID for event emission
   * @param messageId - Optional message ID to update
   * @returns Completed GraphResult
   */
  private buildCompletedResult = async (
    finalState: CIOState,
    threadId: string,
    userId: string,
    messageId?: string | null,
  ): Promise<GraphResult> => {
    this.logger.log('Graph execution completed successfully');

    this.emitCompletionEvent(threadId, userId);

    // Extract citations if CitationService is available (US-002 integration)
    let citationCount = 0;
    if (this.citationService) {
      citationCount = await this.extractCitationsFromExecution(
        threadId,
        userId,
        finalState,
      );
    }

    // Update AI response with final content (if messageId provided)
    if (messageId) {
      await this.updateAssistantMessage(
        threadId,
        userId,
        finalState,
        messageId,
      );
    } else {
      // Fallback: save new message (for resume or legacy flows)
      await this.saveAssistantMessageFromState(threadId, userId, finalState);
    }

    return {
      threadId,
      finalState,
      success: true,
      status: 'COMPLETED',
      citationCount,
    };
  };

  /**
   * Extract final report from graph state
   *
   * @param state - Final graph state
   * @returns Final report string or undefined
   */
  private extractReportFromState = (state: CIOState): string | undefined => {
    // Try to get from final_report field (set by end node)
    if (state.final_report) {
      return state.final_report;
    }

    // Fallback: extract from last AI message
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage) {
      return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    }

    return undefined;
  };

  /**
   * Save assistant message from graph final state
   *
   * Extracts the final report from the last AI message and saves it
   * as a conversation message. Links to reasoning traces for reference.
   * Non-blocking - errors are logged but don't fail the execution.
   *
   * @param threadId - Scoped thread ID
   * @param userId - User ID
   * @param finalState - Final graph state
   */
  private saveAssistantMessageFromState = async (
    threadId: string,
    userId: string,
    finalState: CIOState,
  ): Promise<void> => {
    try {
      const finalReport = this.extractReportFromState(finalState);

      if (!finalReport || finalReport.trim() === '') {
        this.logger.debug(
          `No final report found in state for thread ${threadId}, skipping AI message save`,
        );
        return;
      }

      // Get trace IDs for linking
      const traces = await this.tracingService.getTracesByThread(
        threadId,
        userId,
      );
      const traceIds = traces.map((t) => t.id);

      // Save the assistant message
      await this.conversationService.saveAssistantMessage({
        threadId,
        userId,
        content: finalReport,
        traceIds,
        modelUsed: process.env.GEMINI_MODEL || getDefaultModel(),
      });

      this.logger.debug(
        `AI message saved for thread ${threadId} with ${traceIds.length} trace links`,
      );
    } catch (error) {
      // Don't fail graph execution if message save fails
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to save AI message for thread ${threadId}: ${errorMessage}`,
      );
    }
  };

  /**
   * Update assistant message with final content
   *
   * Updates the placeholder message created before graph execution
   * with the final report and trace links.
   *
   * @param threadId - Scoped thread ID
   * @param userId - User ID
   * @param finalState - Final graph state
   * @param messageId - Message ID to update
   */
  private updateAssistantMessage = async (
    threadId: string,
    userId: string,
    finalState: CIOState,
    messageId: string,
  ): Promise<void> => {
    try {
      const finalReport = this.extractReportFromState(finalState);

      if (!finalReport || finalReport.trim() === '') {
        this.logger.warn(
          `No final report found in state for thread ${threadId}, skipping message update. State keys: ${Object.keys(finalState).join(', ')}`,
        );
        return;
      }

      // Get trace IDs for the specific message
      const traces = await this.tracingService.getTracesByMessageId(
        messageId,
        userId,
      );
      const traceIds = traces.map((t) => t.id);

      // Update the message with final content and trace links
      await this.conversationService.updateAssistantMessage(
        messageId,
        finalReport,
        traceIds,
      );

      this.logger.debug(
        `Message ${messageId} updated with final report (length: ${finalReport.length}) and ${traceIds.length} traces`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to update message ${messageId}: ${errorMessage}`,
      );
    }
  };

  /**
   * Extract citations from graph execution (US-002 integration)
   *
   * Automatically extracts data source citations from tool results and final output.
   * This runs after graph completion and does not block or fail the execution.
   *
   * @param threadId - Scoped thread ID
   * @param userId - User ID
   * @param finalState - Final graph state
   * @returns Number of citations created (0 if extraction fails)
   * @private
   */
  private async extractCitationsFromExecution(
    threadId: string,
    userId: string,
    finalState: CIOState,
  ): Promise<number> {
    try {
      // Extract final output from last AI message
      const lastMessage = finalState.messages[finalState.messages.length - 1];
      if (!(lastMessage instanceof AIMessage)) {
        this.logger.debug(
          'No AI message in final state, skipping citation extraction',
        );
        return 0;
      }

      const finalOutput =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      // Collect tool results from reasoning traces
      const traces = await this.tracingService.getTracesByThread(
        threadId,
        userId,
      );
      const toolResults = traces
        .filter((trace) => trace.toolResults && trace.toolResults.length > 0)
        .flatMap((trace) => trace.toolResults || []);

      // Extract citations
      const citations = await this.citationService?.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      if (!citations) {
        this.logger.debug(
          'No citations extracted, skipping citation extraction',
        );
        return 0;
      }

      this.logger.log(
        `Extracted ${citations.length} citations from ${toolResults.length} tool results (thread: ${threadId})`,
      );

      return citations.length;
    } catch (error) {
      // Don't fail graph execution if citation extraction fails
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Citation extraction failed for thread ${threadId}: ${errorMessage}`,
      );
      return 0;
    }
  }

  /**
   * Emit graph completion event
   *
   * @param threadId - Scoped thread ID
   * @param userId - User ID
   */
  private emitCompletionEvent(threadId: string, userId: string): void {
    this.eventEmitter.emit('graph.complete', {
      threadId,
      userId,
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  /**
   * Handle graph execution errors
   *
   * @param error - Error object
   * @param userId - User ID
   * @param threadId - Scoped thread ID
   * @param initialState - Initial graph state
   * @returns GraphResult or throws error
   */
  private handleGraphExecutionError(
    error: unknown,
    userId: string,
    threadId: string,
    initialState: CIOState,
  ): GraphResult {
    // Handle GuardrailException - iteration limit exceeded
    if (error instanceof GuardrailException) {
      this.logger.warn(
        `Guardrail triggered for user ${userId}: ${error.message}`,
      );

      return {
        threadId,
        finalState: initialState,
        success: false,
        status: 'FAILED',
        error: error.message,
      };
    }

    const graphError = error as GraphExecutionError;

    // Handle interrupt errors (normal HITL flow)
    if (this.interruptHandler.isInterruptError(graphError)) {
      this.logger.log(`Graph interrupted for HITL (thread: ${threadId})`);

      const state = graphError.state || initialState;
      const reason = this.interruptHandler.getInterruptReason(graphError);

      return this.interruptHandler.buildSuspendedResult(
        state,
        threadId,
        reason,
      );
    }

    // Log the error but return a clean failure result instead of crashing
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown internal error';

    this.logger.error(
      `Graph execution failed for user ${userId}: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
    );

    // Return a graceful failure result
    return {
      threadId,
      finalState: initialState,
      success: false,
      status: 'FAILED', // Caller should check this status
      error: 'An internal error occurred while processing your request. Please try again later.',
    };
  }

  /**
   * Handle resume-specific errors
   *
   * @param error - Error object
   * @param userId - User ID
   * @param threadId - Scoped thread ID
   * @returns GraphResult or throws error
   */
  private handleResumeError(
    error: unknown,
    userId: string,
    threadId: string,
  ): GraphResult {
    // Re-throw NestJS HTTP exceptions
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    const graphError = error as GraphExecutionError;

    // Handle checkpoint-related errors
    const checkpointError = this.parseCheckpointError(graphError);
    if (checkpointError) {
      throw checkpointError;
    }

    // Handle interrupt errors during resume
    if (this.interruptHandler.isInterruptError(graphError)) {
      this.logger.log(
        `Graph interrupted again during resume (thread: ${threadId})`,
      );

      const state = graphError.state || ({} as CIOState);
      const reason = this.interruptHandler.getInterruptReason(graphError);

      return this.interruptHandler.buildSuspendedResult(
        state,
        threadId,
        reason,
      );
    }

    // Log and throw generic error
    this.logger.error(
      `Failed to resume graph for user ${userId}, thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error.stack : undefined,
    );

    throw new NotFoundException(
      'Unable to resume thread. Thread may not exist or checkpoint is corrupted.',
    );
  }

  /**
   * Parse checkpoint-related errors and return appropriate exception
   *
   * @param error - Error object
   * @returns NestJS exception or null
   */
  private parseCheckpointError(
    error: GraphExecutionError,
  ): NotFoundException | BadRequestException | null {
    if (!error?.message || typeof error.message !== 'string') {
      return null;
    }

    const errorMsg = error.message.toLowerCase();

    // Thread doesn't exist or checkpoint not found
    if (
      errorMsg.includes('cannot read') ||
      errorMsg.includes('undefined') ||
      errorMsg.includes('checkpoint not found') ||
      errorMsg.includes('no checkpoint')
    ) {
      return new NotFoundException(
        'Thread not found or no checkpoint available. Thread may not exist or was never interrupted.',
      );
    }

    // Thread is not suspended (already completed)
    if (
      errorMsg.includes('already completed') ||
      errorMsg.includes('not suspended')
    ) {
      return new BadRequestException(
        'Thread is not in suspended state. Cannot resume a completed thread.',
      );
    }

    return null;
  }
}
