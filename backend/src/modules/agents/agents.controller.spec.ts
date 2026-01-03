/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { AgentsController } from './agents.controller';
import { OrchestratorService } from './services/orchestrator.service';
import { User } from '../users/entities/user.entity';
import { RunGraphDto } from './dto/run-graph.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AgentsController', () => {
  let controller: AgentsController;
  let orchestratorService: jest.Mocked<OrchestratorService>;

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [
        {
          provide: OrchestratorService,
          useValue: mockOrchestratorService,
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
      .compile();

    controller = module.get<AgentsController>(AgentsController);
    orchestratorService = module.get(OrchestratorService);
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
});
