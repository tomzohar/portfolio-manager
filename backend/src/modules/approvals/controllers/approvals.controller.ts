import {
  Controller,
  Logger,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { ApprovalService } from '../services/approval.service';
import { ApprovalResponseDto } from '../dto/approval-response.dto';
import { RespondToApprovalDto } from '../dto/respond-to-approval.dto';

/**
 * ApprovalsController
 *
 * REST endpoints for HITL approval management.
 * Enables users to view and respond to approval requests.
 *
 * Features:
 * - JWT authentication required
 * - Rate limiting on respond endpoint
 * - Thread ownership validation
 * - Approval ownership validation
 * - Swagger documentation
 *
 * This controller supports US-003: HITL Approval System
 * from the Digital CIO Chat Interface feature.
 */
@ApiTags('approvals')
@Controller('approvals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApprovalsController {
  private readonly logger = new Logger(ApprovalsController.name);

  constructor(private readonly approvalService: ApprovalService) {}

  /**
   * Get all approvals for a thread
   *
   * Returns approvals ordered by creation date (most recent first).
   * Validates that the authenticated user owns the thread.
   *
   * @param threadId - Thread identifier
   * @param user - Authenticated user (from JWT)
   * @returns Array of approvals
   * @throws ForbiddenException if user does not own thread
   */
  @Get('thread/:threadId')
  @ApiOperation({
    summary: 'Get approvals by thread ID',
    description:
      'Retrieves all approval requests for a specific conversation thread. Approvals are ordered by creation date (most recent first).',
  })
  @ApiParam({
    name: 'threadId',
    description: 'Thread identifier',
    example: 'thread-user123-abc456',
  })
  @ApiResponse({
    status: 200,
    description: 'Approvals retrieved successfully',
    type: [ApprovalResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this thread',
  })
  async getApprovalsByThread(
    @Param('threadId') threadId: string,
    @CurrentUser() user: User,
  ): Promise<ApprovalResponseDto[]> {
    this.logger.log(
      `Fetching approvals for thread ${threadId} (user: ${user.email})`,
    );

    const approvals = await this.approvalService.getApprovalsByThread(
      threadId,
      user.id,
    );

    // Map to response DTO
    return approvals.map((approval) => ({
      id: approval.id,
      approvalType: approval.approvalType,
      status: approval.status,
      prompt: approval.prompt,
      context: approval.context,
      expiresAt: approval.expiresAt,
      createdAt: approval.createdAt,
    }));
  }

  /**
   * Respond to an approval request
   *
   * User can approve or reject a pending approval.
   * If approved, the graph execution automatically resumes.
   * If rejected, the graph execution is cancelled.
   *
   * @param approvalId - Approval identifier
   * @param dto - Response data (approved/rejected + optional reason)
   * @param user - Authenticated user (from JWT)
   * @returns Updated approval
   * @throws ForbiddenException if user does not own approval
   * @throws ConflictException if approval already responded or expired
   */
  @Post(':approvalId/respond')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiOperation({
    summary: 'Respond to approval request',
    description:
      'Approve or reject a pending approval. If approved, graph execution automatically resumes. If rejected, execution is cancelled.',
  })
  @ApiParam({
    name: 'approvalId',
    description: 'Approval identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Response recorded successfully',
    type: ApprovalResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this approval',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Approval already responded or expired',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async respondToApproval(
    @Param('approvalId') approvalId: string,
    @Body() dto: RespondToApprovalDto,
    @CurrentUser() user: User,
  ): Promise<ApprovalResponseDto> {
    this.logger.log(
      `User ${user.email} responding to approval ${approvalId}: ${dto.response}`,
    );

    const approval = await this.approvalService.respondToApproval(
      approvalId,
      user.id,
      dto.response,
      dto.reason,
    );

    // Map to response DTO
    return {
      id: approval.id,
      approvalType: approval.approvalType,
      status: approval.status,
      prompt: approval.prompt,
      context: approval.context,
      expiresAt: approval.expiresAt,
      createdAt: approval.createdAt,
    };
  }
}
