import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReasoningTrace } from '../entities/reasoning-trace.entity';
import { TraceStatus } from '../types/trace-status.enum';
import type { ToolResult } from '../types/tool-result.interface';
import { TOOL_RESULTS_CONFIG } from '../types/tool-result.interface';

/**
 * TracingService
 *
 * Handles persistence and querying of agent reasoning traces.
 * Each trace represents one node execution in the LangGraph workflow.
 * Provides transparency and debugging capabilities for agent decision-making.
 *
 * Enhanced for US-001: Step-by-Step Reasoning Transparency
 * - Real-time status updates via SSE
 * - Tool result tracking
 * - Duration metrics
 * - Error handling with detailed messages
 */
@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);

  constructor(
    @InjectRepository(ReasoningTrace)
    private readonly reasoningTraceRepository: Repository<ReasoningTrace>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Record a reasoning trace for a node execution
   *
   * @param threadId - Unique identifier for the graph execution thread
   * @param userId - User ID (required for security)
   * @param nodeName - Name of the node that was executed
   * @param input - Input data passed to the node (JSONB)
   * @param output - Output data returned by the node (JSONB)
   * @param reasoning - Human-readable explanation of the node's decision
   * @param options - Optional parameters (status, toolResults, durationMs, error, stepIndex)
   * @returns Saved ReasoningTrace entity
   * @throws BadRequestException if userId is missing
   */
  async recordTrace(
    threadId: string,
    userId: string,
    nodeName: string,
    input: Record<string, any>,
    output: Record<string, any>,
    reasoning: string,
    options?: {
      status?: TraceStatus;
      toolResults?: ToolResult[];
      durationMs?: number;
      error?: string;
      stepIndex?: number;
    },
  ): Promise<ReasoningTrace> {
    // Security validation: userId is required
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('userId is required for security');
    }

    const trace = this.reasoningTraceRepository.create({
      threadId,
      userId,
      nodeName,
      input,
      output,
      reasoning,
      status: options?.status || TraceStatus.COMPLETED,
      toolResults: options?.toolResults,
      durationMs: options?.durationMs,
      error: options?.error,
      stepIndex: options?.stepIndex,
    });

    const saved = await this.reasoningTraceRepository.save(trace);

    this.logger.debug(
      `Recorded trace for node "${nodeName}" in thread ${threadId} (user: ${userId})`,
    );

    return saved;
  }

  /**
   * Get all traces for a specific thread
   *
   * @param threadId - Thread identifier
   * @param userId - User ID (for security filtering)
   * @returns Array of traces in chronological order
   */
  async getTracesByThread(
    threadId: string,
    userId: string,
  ): Promise<ReasoningTrace[]> {
    return this.reasoningTraceRepository.find({
      where: { threadId, userId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get recent traces for a user
   *
   * @param userId - User ID
   * @param limit - Maximum number of traces to return (default: 100)
   * @returns Array of traces in descending order (most recent first)
   */
  async getTracesByUser(
    userId: string,
    limit: number = 100,
  ): Promise<ReasoningTrace[]> {
    return this.reasoningTraceRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Update trace status (US-001 enhancement)
   *
   * @param traceId - Trace ID to update
   * @param status - New status
   * @param error - Optional error message if status is 'failed'
   * @returns Updated trace
   * @throws NotFoundException if trace not found
   */
  async updateTraceStatus(
    traceId: string,
    status: TraceStatus,
    error?: string,
  ): Promise<ReasoningTrace> {
    const trace = await this.reasoningTraceRepository.findOne({
      where: { id: traceId },
    });

    if (!trace) {
      this.logger.warn(`Trace ${traceId} not found for status update`);
      throw new NotFoundException(`Trace ${traceId} not found`);
    }

    trace.status = status;
    if (error) {
      trace.error = error;
    }

    const updated = await this.reasoningTraceRepository.save(trace);

    // Emit SSE event for real-time updates
    this.eventEmitter.emit('trace.status_updated', {
      traceId: updated.id,
      threadId: updated.threadId,
      userId: updated.userId,
      status: updated.status,
      error: updated.error,
    });

    this.logger.debug(`Updated trace ${traceId} status to ${status}`);

    return updated;
  }

  /**
   * Record trace execution duration (US-001 enhancement)
   *
   * @param traceId - Trace ID to update
   * @param durationMs - Duration in milliseconds
   * @returns Updated trace
   * @throws NotFoundException if trace not found
   * @throws BadRequestException if durationMs is negative
   */
  async recordTraceDuration(
    traceId: string,
    durationMs: number,
  ): Promise<ReasoningTrace> {
    // Validate durationMs is not negative
    if (durationMs < 0) {
      throw new BadRequestException(
        `Duration must be >= 0, got: ${durationMs}`,
      );
    }

    const trace = await this.reasoningTraceRepository.findOne({
      where: { id: traceId },
    });

    if (!trace) {
      this.logger.warn(`Trace ${traceId} not found for duration update`);
      throw new NotFoundException(`Trace ${traceId} not found`);
    }

    trace.durationMs = durationMs;

    const updated = await this.reasoningTraceRepository.save(trace);

    this.logger.debug(`Recorded duration ${durationMs}ms for trace ${traceId}`);

    return updated;
  }

  /**
   * Attach tool results to a trace (US-001 enhancement)
   *
   * @param traceId - Trace ID to update
   * @param toolResults - Array of tool results with tool name and result data
   * @returns Updated trace
   * @throws NotFoundException if trace not found
   * @throws BadRequestException if toolResults is invalid or too large
   */
  async attachToolResults(
    traceId: string,
    toolResults: ToolResult[],
  ): Promise<ReasoningTrace> {
    // Validate toolResults is array
    if (!Array.isArray(toolResults)) {
      throw new BadRequestException('toolResults must be an array');
    }

    // Limit array size to prevent JSONB overflow
    if (toolResults.length > TOOL_RESULTS_CONFIG.MAX_TOOL_RESULTS) {
      throw new BadRequestException(
        `toolResults array size (${toolResults.length}) exceeds maximum (${TOOL_RESULTS_CONFIG.MAX_TOOL_RESULTS})`,
      );
    }

    const trace = await this.reasoningTraceRepository.findOne({
      where: { id: traceId },
    });

    if (!trace) {
      this.logger.warn(`Trace ${traceId} not found for tool results update`);
      throw new NotFoundException(`Trace ${traceId} not found`);
    }

    trace.toolResults = toolResults;

    const updated = await this.reasoningTraceRepository.save(trace);

    // Emit SSE event for real-time updates
    this.eventEmitter.emit('trace.tools_executed', {
      traceId: updated.id,
      threadId: updated.threadId,
      userId: updated.userId,
      toolCount: toolResults.length,
    });

    this.logger.debug(
      `Attached ${toolResults.length} tool results to trace ${traceId}`,
    );

    return updated;
  }

  /**
   * Start a new trace (US-001 enhancement)
   *
   * Helper method to create a trace at node start with status='running'
   * and auto-incremented stepIndex.
   *
   * @param threadId - Thread identifier
   * @param userId - User ID (required for security)
   * @param nodeName - Name of the node being executed
   * @param input - Input data for the node
   * @returns Created trace
   * @throws BadRequestException if userId is missing
   */
  async startTrace(
    threadId: string,
    userId: string,
    nodeName: string,
    input: Record<string, any>,
  ): Promise<ReasoningTrace> {
    // Security validation: userId is required
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('userId is required for security');
    }

    // Get max stepIndex for this thread and auto-increment
    const maxStepResult = await this.reasoningTraceRepository
      .createQueryBuilder('trace')
      .select('MAX(trace.stepIndex)', 'max')
      .where('trace.threadId = :threadId', { threadId })
      .getRawOne<{ max: string | null }>();

    const nextStepIndex =
      maxStepResult?.max !== null && maxStepResult?.max !== undefined
        ? parseInt(maxStepResult.max, 10) + 1
        : 0;

    const trace = this.reasoningTraceRepository.create({
      threadId,
      userId,
      nodeName,
      input,
      output: {},
      reasoning: '',
      status: TraceStatus.RUNNING,
      stepIndex: nextStepIndex,
    });

    const saved = await this.reasoningTraceRepository.save(trace);

    // Emit SSE event for node start
    this.eventEmitter.emit('node.start', {
      traceId: saved.id,
      threadId: saved.threadId,
      userId: saved.userId,
      nodeName: saved.nodeName,
      stepIndex: saved.stepIndex,
    });

    this.logger.debug(
      `Started trace for node "${nodeName}" in thread ${threadId} (step ${nextStepIndex})`,
    );

    return saved;
  }

  /**
   * Complete a trace (US-001 enhancement)
   *
   * Helper method to complete a trace at node end with output, reasoning,
   * duration, and status='completed'.
   *
   * @param traceId - Trace ID to complete
   * @param output - Output data from the node
   * @param reasoning - Human-readable explanation
   * @param durationMs - Execution duration in milliseconds
   * @returns Updated trace
   * @throws NotFoundException if trace not found
   * @throws BadRequestException if durationMs is negative
   */
  async completeTrace(
    traceId: string,
    output: Record<string, any>,
    reasoning: string,
    durationMs: number,
  ): Promise<ReasoningTrace> {
    // Validate durationMs is not negative
    if (durationMs < 0) {
      throw new BadRequestException(
        `Duration must be >= 0, got: ${durationMs}`,
      );
    }

    const trace = await this.reasoningTraceRepository.findOne({
      where: { id: traceId },
    });

    if (!trace) {
      this.logger.warn(`Trace ${traceId} not found for completion`);
      throw new NotFoundException(`Trace ${traceId} not found`);
    }

    trace.output = output;
    trace.reasoning = reasoning;
    trace.durationMs = durationMs;
    trace.status = TraceStatus.COMPLETED;

    const updated = await this.reasoningTraceRepository.save(trace);

    // Emit SSE event for node completion
    this.eventEmitter.emit('node.complete', {
      traceId: updated.id,
      threadId: updated.threadId,
      userId: updated.userId,
      nodeName: updated.nodeName,
      durationMs: updated.durationMs,
    });

    this.logger.debug(
      `Completed trace ${traceId} for node "${trace.nodeName}" in ${durationMs}ms`,
    );

    return updated;
  }
}
