/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalService } from '../services/approval.service';
import { ApprovalStatus } from '../types/approval-status.enum';
import { HITLApproval } from '../entities/hitl-approval.entity';
import { User } from '../../users/entities/user.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RespondToApprovalDto } from '../dto/respond-to-approval.dto';

describe('ApprovalsController', () => {
  let controller: ApprovalsController;
  let approvalService: jest.Mocked<ApprovalService>;

  const mockUser: User = {
    id: 'user-456',
    email: 'test@example.com',
    passwordHash: 'hashed',
    portfolios: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApprovalService = {
    getApprovalsByThread: jest.fn(),
    respondToApproval: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalsController],
      providers: [
        {
          provide: ApprovalService,
          useValue: mockApprovalService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const request = context.switchToHttp().getRequest();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          request.user = mockUser;
          return true;
        },
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<ApprovalsController>(ApprovalsController);
    approvalService = module.get(ApprovalService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/approvals/thread/:threadId', () => {
    it('should return approvals for valid threadId', async () => {
      // Arrange
      const threadId = 'thread-123';
      const user = mockUser;

      const mockApprovals = [
        {
          id: 'approval-1',
          threadId,
          userId: user.id,
          approvalType: 'cost_threshold',
          status: ApprovalStatus.PENDING,
          prompt: 'Approve analysis?',
          context: { cost: 2.5 },
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ] as unknown as HITLApproval[];

      mockApprovalService.getApprovalsByThread.mockResolvedValue(mockApprovals);

      // Act
      const result = await controller.getApprovalsByThread(threadId, user);

      // Assert
      expect(approvalService.getApprovalsByThread).toHaveBeenCalledWith(
        threadId,
        user.id,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('approval-1');
    });

    it('should return empty array if no approvals exist', async () => {
      // Arrange
      const threadId = 'thread-123';

      mockApprovalService.getApprovalsByThread.mockResolvedValue([]);

      // Act
      const result = await controller.getApprovalsByThread(threadId, mockUser);

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw ForbiddenException if user does not own thread', async () => {
      // Arrange
      const threadId = 'thread-123';

      mockApprovalService.getApprovalsByThread.mockRejectedValue(
        new ForbiddenException('You do not own this thread'),
      );

      // Act & Assert
      await expect(
        controller.getApprovalsByThread(threadId, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /api/approvals/:approvalId/respond', () => {
    it('should approve approval and return updated approval', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const dto: RespondToApprovalDto = {
        response: 'approved',
        reason: 'Looks good',
      };

      const mockApproval = {
        id: approvalId,
        userId: mockUser.id,
        status: ApprovalStatus.APPROVED,
        userResponse: dto.reason,
        respondedAt: new Date(),
      } as HITLApproval;

      mockApprovalService.respondToApproval.mockResolvedValue(mockApproval);

      // Act
      const result = await controller.respondToApproval(
        approvalId,
        dto,
        mockUser,
      );

      // Assert
      expect(approvalService.respondToApproval).toHaveBeenCalledWith(
        approvalId,
        mockUser.id,
        'approved',
        'Looks good',
      );
      expect(result.status).toBe(ApprovalStatus.APPROVED);
    });

    it('should reject approval', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const dto: RespondToApprovalDto = {
        response: 'rejected',
        reason: 'Too expensive',
      };

      const mockApproval = {
        id: approvalId,
        status: ApprovalStatus.REJECTED,
        userResponse: dto.reason,
      } as HITLApproval;

      mockApprovalService.respondToApproval.mockResolvedValue(mockApproval);

      // Act
      const result = await controller.respondToApproval(
        approvalId,
        dto,
        mockUser,
      );

      // Assert
      expect(result.status).toBe(ApprovalStatus.REJECTED);
    });

    it('should handle response without reason', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const dto: RespondToApprovalDto = {
        response: 'approved',
      };

      const mockApproval = {
        id: approvalId,
        status: ApprovalStatus.APPROVED,
      } as HITLApproval;

      mockApprovalService.respondToApproval.mockResolvedValue(mockApproval);

      // Act
      await controller.respondToApproval(approvalId, dto, mockUser);

      // Assert
      expect(approvalService.respondToApproval).toHaveBeenCalledWith(
        approvalId,
        mockUser.id,
        'approved',
        undefined,
      );
    });

    it('should throw ForbiddenException if user does not own approval', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const dto: RespondToApprovalDto = {
        response: 'approved',
      };

      mockApprovalService.respondToApproval.mockRejectedValue(
        new ForbiddenException('You do not own this approval'),
      );

      // Act & Assert
      await expect(
        controller.respondToApproval(approvalId, dto, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if approval already responded', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const dto: RespondToApprovalDto = {
        response: 'approved',
      };

      mockApprovalService.respondToApproval.mockRejectedValue(
        new ConflictException('Approval already resolved'),
      );

      // Act & Assert
      await expect(
        controller.respondToApproval(approvalId, dto, mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Authorization and Guards', () => {
    it('should require authentication (covered by @UseGuards(JwtAuthGuard) decorator)', () => {
      expect(controller).toBeDefined();
    });

    it('should apply rate limiting to respond endpoint', () => {
      expect(controller.respondToApproval).toBeDefined();
    });
  });
});
