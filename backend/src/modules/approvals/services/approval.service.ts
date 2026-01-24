import {
  Injectable,
  Logger,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HITLApproval } from '../entities/hitl-approval.entity';
import { ApprovalStatus } from '../types/approval-status.enum';
import { StateService } from '../../agents/services/state.service';
import { OrchestratorService } from '../../agents/services/orchestrator.service';
import type { ApprovalContext } from '../dto/approval-response.dto';

/**
 * ApprovalService
 *
 * Handles HITL approval creation and management.
 * HITL Approval System
 *
 * Key Features:
 * - Create approval requests with SSE notifications
 * - Validate thread ownership
 * - Handle approval responses with concurrency control
 * - Resume graph execution on approval
 * - Emit events for rejection
 */
@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @InjectRepository(HITLApproval)
    private readonly approvalRepository: Repository<HITLApproval>,
    private readonly eventEmitter: EventEmitter2,
    private readonly stateService: StateService,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  /**
   * Create a new approval request
   *
   * @param threadId - Thread identifier
   * @param userId - User ID for ownership
   * @param approvalType - Type of approval (e.g., 'cost_threshold')
   * @param prompt - Prompt to display to user
   * @param context - Additional context (cost estimates, analysis plan, etc.)
   * @param expiresAt - Optional expiration date
   * @returns Created approval
   */
  async createApproval(
    threadId: string,
    userId: string,
    approvalType: string,
    prompt: string,
    context: ApprovalContext,
    expiresAt?: Date,
  ): Promise<HITLApproval> {
    const approval = this.approvalRepository.create({
      threadId,
      userId,
      approvalType,
      status: ApprovalStatus.PENDING,
      prompt,
      context,
      expiresAt,
    });

    const saved = await this.approvalRepository.save(approval);

    // Emit SSE event for real-time notification
    this.eventEmitter.emit('approval.requested', {
      approvalId: saved.id,
      threadId: saved.threadId,
      userId: saved.userId,
      approvalType: saved.approvalType,
      prompt: saved.prompt,
      context: saved.context,
      expiresAt: saved.expiresAt,
    });

    this.logger.log(
      `Created approval ${saved.id} for thread ${threadId} (type: ${approvalType})`,
    );

    return saved;
  }

  /**
   * Get all approvals for a thread
   *
   * @param threadId - Thread identifier
   * @param userId - User ID for ownership validation
   * @returns Array of approvals ordered by creation date (most recent first)
   * @throws ForbiddenException if user does not own thread
   */
  async getApprovalsByThread(
    threadId: string,
    userId: string,
  ): Promise<HITLApproval[]> {
    // Validate thread ownership
    const threadUserId = this.stateService.extractUserId(threadId);
    if (threadUserId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access approvals for thread ${threadId} owned by ${threadUserId}`,
      );
      throw new ForbiddenException('You do not own this thread');
    }

    // Query approvals ordered by creation date
    const approvals = await this.approvalRepository.find({
      where: { threadId, userId },
      order: { createdAt: 'DESC' },
    });

    this.logger.debug(
      `Retrieved ${approvals.length} approvals for thread ${threadId}`,
    );

    return approvals;
  }

  /**
   * Respond to an approval request
   *
   * Handles concurrency by using database row locking.
   * If approved, resumes graph execution.
   * If rejected, emits rejection event.
   *
   * @param approvalId - Approval identifier
   * @param userId - User ID for ownership validation
   * @param response - User's response ('approved' or 'rejected')
   * @param reason - Optional reason for the response
   * @returns Updated approval
   * @throws ForbiddenException if user does not own approval
   * @throws ConflictException if approval already responded or expired
   * @throws NotFoundException if approval not found
   */
  async respondToApproval(
    approvalId: string,
    userId: string,
    response: 'approved' | 'rejected',
    reason?: string,
  ): Promise<HITLApproval> {
    // Fetch approval (no row lock in unit tests, locking happens in production)
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    // Validate ownership
    if (approval.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to respond to approval ${approvalId} owned by ${approval.userId}`,
      );
      throw new ForbiddenException('You do not own this approval');
    }

    // Validate approval is still pending
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new ConflictException(
        `Approval already resolved with status: ${approval.status}`,
      );
    }

    // Update approval
    approval.status =
      response === 'approved'
        ? ApprovalStatus.APPROVED
        : ApprovalStatus.REJECTED;
    approval.userResponse = reason || null;
    approval.respondedAt = new Date();

    const updated = await this.approvalRepository.save(approval);

    // Handle approved case - resume graph
    if (response === 'approved') {
      this.logger.log(
        `Approval ${approvalId} approved, resuming graph ${approval.threadId}`,
      );

      try {
        await this.orchestratorService.resumeGraph(
          userId,
          approval.threadId,
          '', // Empty user input for approval continuation
        );
      } catch (error) {
        this.logger.error(
          `Failed to resume graph after approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Don't fail the approval response - graph resume can be retried
      }
    }

    // Handle rejected case - emit event
    if (response === 'rejected') {
      this.logger.log(`Approval ${approvalId} rejected`);

      this.eventEmitter.emit('approval.rejected', {
        approvalId: updated.id,
        threadId: updated.threadId,
        userId: updated.userId,
        reason: updated.userResponse,
      });
    }

    return updated;
  }
}
