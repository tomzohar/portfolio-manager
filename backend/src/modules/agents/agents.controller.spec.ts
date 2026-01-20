/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { AgentsController } from './agents.controller';
import { OrchestratorService } from './services/orchestrator.service';
import { TracingService } from './services/tracing.service';
import { StateService } from './services/state.service';
import { User } from '../users/entities/user.entity';
import { RunGraphDto } from './dto/run-graph.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('AgentsController', () => {
  let controller: AgentsController;
  let orchestratorService: jest.Mocked<OrchestratorService>;
  let tracingService: jest.Mocked<TracingService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let stateService: jest.Mocked<StateService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    passwordHash: 'hashed',
    portfolios: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrchestratorService = {
    runGraph: jest.fn(),
    streamGraph: jest.fn(),
  };

  const mockTracingService = {
    recordTrace: jest.fn(),
    getTracesByThread: jest.fn(),
    getTracesByUser: jest.fn(),
  };

  const mockStateService = {
    getSaver: jest.fn(),
    scopeThreadId: jest.fn(),
    extractUserId: jest.fn((threadId: string) => {
      const parts = threadId.split(':');
      return parts.length === 2 ? parts[0] : null;
    }),
    extractThreadId: jest.fn(),
  };

  const mockEventEmitter = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [
        {
          provide: OrchestratorService,
          useValue: mockOrchestratorService,
        },
        {
          provide: TracingService,
          useValue: mockTracingService,
        },
        {
          provide: StateService,
          useValue: mockStateService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockUser;
          return true;
        },
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({
        canActivate: () => true, // Allow all requests in unit tests
      })
      .compile();

    controller = module.get<AgentsController>(AgentsController);
    orchestratorService = module.get(OrchestratorService);
    tracingService = module.get(TracingService);
    stateService = module.get(StateService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('runGraph', () => {
    it('should execute graph with user context', async () => {
      const dto: RunGraphDto = {
        message: 'Analyze my portfolio',
      };

      const mockResult = {
        threadId: 'user-123:thread-abc',
        finalState: {
          userId: mockUser.id,
          final_report: 'Report content',
          messages: [],
          errors: [],
          iteration: 1,
          maxIterations: 10,
        },
        success: true,
      };

      mockOrchestratorService.runGraph.mockResolvedValue(mockResult);

      const result = await controller.runGraph(mockUser, dto);

      expect(orchestratorService.runGraph).toHaveBeenCalledWith(
        mockUser.id,
        {
          message: dto.message,
          portfolio: undefined,
        },
        undefined,
      );
      expect(result).toEqual(mockResult);
    });

    it('should pass portfolio data if provided', async () => {
      const dto: RunGraphDto = {
        message: 'Analyze portfolio',
        portfolio: { positions: [] },
      };

      const mockResult = {
        threadId: 'thread-id',
        finalState: {} as any,
        success: true,
      };

      mockOrchestratorService.runGraph.mockResolvedValue(mockResult);

      await controller.runGraph(mockUser, dto);

      expect(orchestratorService.runGraph).toHaveBeenCalledWith(
        mockUser.id,
        {
          message: dto.message,
          portfolio: dto.portfolio,
        },
        undefined,
      );
    });

    it('should pass threadId for resuming conversation', async () => {
      const dto: RunGraphDto = {
        message: 'Continue analysis',
        threadId: 'existing-thread-id',
      };

      const mockResult = {
        threadId: 'user-123:existing-thread-id',
        finalState: {} as any,
        success: true,
      };

      mockOrchestratorService.runGraph.mockResolvedValue(mockResult);

      await controller.runGraph(mockUser, dto);

      expect(orchestratorService.runGraph).toHaveBeenCalledWith(
        mockUser.id,
        {
          message: dto.message,
          portfolio: undefined,
        },
        dto.threadId,
      );
    });

    it('should handle service errors', async () => {
      const dto: RunGraphDto = {
        message: 'Test',
      };

      mockOrchestratorService.runGraph.mockRejectedValue(
        new Error('Graph execution failed'),
      );

      await expect(controller.runGraph(mockUser, dto)).rejects.toThrow(
        'Graph execution failed',
      );
    });
  });

  describe('getTraces', () => {
    const threadId = `${mockUser.id}:thread-abc`;

    it('should retrieve traces for thread with user filtering', async () => {
      const mockTraces = [
        {
          id: 'trace-1',
          threadId,
          userId: mockUser.id,
          nodeName: 'observer',
          input: { message: 'Test' },
          output: { data: 'result' },
          reasoning: 'Fetching data',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'trace-2',
          threadId,
          userId: mockUser.id,
          nodeName: 'end',
          input: { data: 'result' },
          output: { final: 'report' },
          reasoning: 'Generating report',
          createdAt: new Date('2024-01-15T10:00:05Z'),
        },
      ];

      mockTracingService.getTracesByThread.mockResolvedValue(mockTraces as any);

      const result = await controller.getTraces(mockUser, threadId);

      expect(tracingService.getTracesByThread).toHaveBeenCalledWith(
        threadId,
        mockUser.id,
      );
      expect(result).toEqual({
        threadId,
        traces: mockTraces,
      });
    });

    it('should return empty array when no traces found', async () => {
      mockTracingService.getTracesByThread.mockResolvedValue([]);

      const result = await controller.getTraces(mockUser, threadId);

      expect(tracingService.getTracesByThread).toHaveBeenCalledWith(
        threadId,
        mockUser.id,
      );
      expect(result).toEqual({
        threadId,
        traces: [],
      });
    });

    it('should pass userId for security filtering', async () => {
      mockTracingService.getTracesByThread.mockResolvedValue([]);

      await controller.getTraces(mockUser, threadId);

      // Verify userId is always passed to ensure security filtering
      expect(tracingService.getTracesByThread).toHaveBeenCalledWith(
        threadId,
        mockUser.id,
      );
    });

    it('should handle service errors', async () => {
      mockTracingService.getTracesByThread.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getTraces(mockUser, threadId)).rejects.toThrow(
        'Database error',
      );
    });

    it('should throw ForbiddenException when accessing another users thread', async () => {
      const otherUserId = 'other-user-456';
      const otherUserThreadId = `${otherUserId}:thread-xyz`;

      await expect(
        controller.getTraces(mockUser, otherUserThreadId),
      ).rejects.toThrow('Cannot access threads belonging to other users');
    });

    it('should throw ForbiddenException for invalid threadId format', async () => {
      const invalidThreadId = 'invalid-format-without-colon';

      await expect(
        controller.getTraces(mockUser, invalidThreadId),
      ).rejects.toThrow('Cannot access threads belonging to other users');
    });
  });
});
