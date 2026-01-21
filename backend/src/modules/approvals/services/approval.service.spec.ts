import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalService } from './approval.service';
import { HITLApproval } from '../entities/hitl-approval.entity';
import { ApprovalStatus } from '../types/approval-status.enum';
import { StateService } from '../../agents/services/state.service';
import { OrchestratorService } from '../../agents/services/orchestrator.service';

describe('ApprovalService', () => {
  let service: ApprovalService;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let stateService: jest.Mocked<StateService>;
  let orchestratorService: jest.Mocked<OrchestratorService>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockStateService = {
    extractUserId: jest.fn(),
  };

  const mockOrchestratorService = {
    resumeGraph: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        {
          provide: getRepositoryToken(HITLApproval),
          useValue: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: StateService,
          useValue: mockStateService,
        },
        {
          provide: OrchestratorService,
          useValue: mockOrchestratorService,
        },
      ],
    }).compile();

    service = module.get<ApprovalService>(ApprovalService);
    eventEmitter = module.get(EventEmitter2);
    stateService = module.get(StateService);
    orchestratorService = module.get(OrchestratorService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createApproval', () => {
    it('should create approval with status PENDING', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const approvalType = 'cost_threshold';
      const prompt = 'Analysis will cost $2.50. Approve?';
      const context = { costEstimate: { totalCostUSD: 2.5 } };
      const expiresAt = new Date(Date.now() + 3600000);

      const mockApproval = {
        id: 'approval-789',
        threadId,
        userId,
        approvalType,
        status: ApprovalStatus.PENDING,
        prompt,
        context,
        expiresAt,
        createdAt: new Date(),
      } as unknown as HITLApproval;

      mockRepository.create.mockReturnValue(mockApproval);
      mockRepository.save.mockResolvedValue(mockApproval);

      // Act
      const result = await service.createApproval(
        threadId,
        userId,
        approvalType,
        prompt,
        context,
        expiresAt,
      );

      // Assert
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(mockRepository.create).toHaveBeenCalledWith({
        threadId,
        userId,
        approvalType,
        status: ApprovalStatus.PENDING,
        prompt,
        context,
        expiresAt,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should emit SSE event when approval is created', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const approvalType = 'cost_threshold';
      const prompt = 'Approve?';
      const context = { cost: 2.5 };

      const mockApproval = {
        id: 'approval-789',
        threadId,
        userId,
        status: ApprovalStatus.PENDING,
      } as HITLApproval;

      mockRepository.create.mockReturnValue(mockApproval);
      mockRepository.save.mockResolvedValue(mockApproval);

      // Act
      await service.createApproval(
        threadId,
        userId,
        approvalType,
        prompt,
        context,
      );

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'approval.requested',
        expect.objectContaining({
          approvalId: 'approval-789',
          threadId,
          userId,
        }),
      );
    });

    it('should handle optional expiresAt parameter', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';

      const mockApproval = {
        id: 'approval-789',
        expiresAt: null,
      } as HITLApproval;

      mockRepository.create.mockReturnValue(mockApproval);
      mockRepository.save.mockResolvedValue(mockApproval);

      // Act
      const result = await service.createApproval(
        threadId,
        userId,
        'cost_threshold',
        'Approve?',
        {},
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: undefined,
        }),
      );
    });
  });

  describe('getApprovalsByThread', () => {
    it('should retrieve approvals for valid thread ownership', async () => {
      // Arrange
      const threadId = 'thread-user123-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-123');

      const mockApprovals = [
        {
          id: 'approval-1',
          threadId,
          userId,
          status: ApprovalStatus.PENDING,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'approval-2',
          threadId,
          userId,
          status: ApprovalStatus.APPROVED,
          createdAt: new Date('2024-01-15T09:00:00Z'),
        },
      ] as HITLApproval[];

      mockRepository.find.mockResolvedValue(mockApprovals);

      // Act
      const result = await service.getApprovalsByThread(threadId, userId);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(stateService.extractUserId).toHaveBeenCalledWith(threadId);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockApprovals);
    });

    it('should throw ForbiddenException if user does not own thread', async () => {
      // Arrange
      const threadId = 'thread-user999-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-999');

      // Act & Assert
      await expect(
        service.getApprovalsByThread(threadId, userId),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('should return empty array if no approvals exist', async () => {
      // Arrange
      const threadId = 'thread-user123-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-123');
      mockRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getApprovalsByThread(threadId, userId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should order approvals by created_at DESC (most recent first)', async () => {
      // Arrange
      const threadId = 'thread-user123-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-123');
      mockRepository.find.mockResolvedValue([]);

      // Act
      await service.getApprovalsByThread(threadId, userId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('respondToApproval', () => {
    it('should approve and resume graph', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const userId = 'user-456';
      const threadId = 'thread-789';
      const response = 'approved';

      const mockApproval = {
        id: approvalId,
        userId,
        threadId,
        status: ApprovalStatus.PENDING,
      } as HITLApproval;

      const updatedApproval = {
        ...mockApproval,
        status: ApprovalStatus.APPROVED,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        respondedAt: expect.any(Date),
      };

      mockRepository.findOne.mockResolvedValue(mockApproval);
      mockRepository.save.mockResolvedValue(updatedApproval);
      mockOrchestratorService.resumeGraph.mockResolvedValue({
        success: true,
      } as any);

      // Act
      const result = await service.respondToApproval(
        approvalId,
        userId,
        response,
      );

      // Assert
      expect(result.status).toBe(ApprovalStatus.APPROVED);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(orchestratorService.resumeGraph).toHaveBeenCalledWith(
        userId,
        threadId,
        '',
      );
    });

    it('should reject and emit event', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const userId = 'user-456';
      const response = 'rejected';
      const reason = 'Too expensive';

      const mockApproval = {
        id: approvalId,
        userId,
        threadId: 'thread-789',
        status: ApprovalStatus.PENDING,
      } as HITLApproval;

      const updatedApproval = {
        ...mockApproval,
        status: ApprovalStatus.REJECTED,
        userResponse: reason,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        respondedAt: expect.any(Date),
      };

      mockRepository.findOne.mockResolvedValue(mockApproval);
      mockRepository.save.mockResolvedValue(updatedApproval);

      // Act
      const result = await service.respondToApproval(
        approvalId,
        userId,
        response,
        reason,
      );

      // Assert
      expect(result.status).toBe(ApprovalStatus.REJECTED);
      expect(result.userResponse).toBe(reason);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'approval.rejected',
        expect.any(Object),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(orchestratorService.resumeGraph).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own approval', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const userId = 'user-456';

      const mockApproval = {
        id: approvalId,
        userId: 'user-999', // Different user
        status: ApprovalStatus.PENDING,
      } as HITLApproval;

      mockRepository.findOne.mockResolvedValue(mockApproval);

      // Act & Assert
      await expect(
        service.respondToApproval(approvalId, userId, 'approved'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if approval already responded', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const userId = 'user-456';

      const mockApproval = {
        id: approvalId,
        userId,
        status: ApprovalStatus.APPROVED, // Already approved
      } as HITLApproval;

      mockRepository.findOne.mockResolvedValue(mockApproval);

      // Act & Assert
      await expect(
        service.respondToApproval(approvalId, userId, 'approved'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if approval expired', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const userId = 'user-456';

      const mockApproval = {
        id: approvalId,
        userId,
        status: ApprovalStatus.EXPIRED,
      } as HITLApproval;

      mockRepository.findOne.mockResolvedValue(mockApproval);

      // Act & Assert
      await expect(
        service.respondToApproval(approvalId, userId, 'approved'),
      ).rejects.toThrow(ConflictException);
    });

    it('should include optional reason in userResponse', async () => {
      // Arrange
      const approvalId = 'approval-123';
      const userId = 'user-456';
      const reason = 'Looks good, proceed';

      const mockApproval = {
        id: approvalId,
        userId,
        threadId: 'thread-789',
        status: ApprovalStatus.PENDING,
      } as HITLApproval;

      mockRepository.findOne.mockResolvedValue(mockApproval);
      mockRepository.save.mockResolvedValue({
        ...mockApproval,
        status: ApprovalStatus.APPROVED,
        userResponse: reason,
      });
      mockOrchestratorService.resumeGraph.mockResolvedValue({} as any);

      // Act
      const result = await service.respondToApproval(
        approvalId,
        userId,
        'approved',
        reason,
      );

      // Assert
      expect(result.userResponse).toBe(reason);
    });
  });
});
