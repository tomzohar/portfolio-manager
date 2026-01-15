import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReasoningTrace } from '../entities/reasoning-trace.entity';

/**
 * TracingService
 *
 * Handles persistence and querying of agent reasoning traces.
 * Each trace represents one node execution in the LangGraph workflow.
 * Provides transparency and debugging capabilities for agent decision-making.
 */
@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);

  constructor(
    @InjectRepository(ReasoningTrace)
    private readonly reasoningTraceRepository: Repository<ReasoningTrace>,
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
}
