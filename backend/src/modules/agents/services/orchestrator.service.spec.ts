/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrchestratorService } from './orchestrator.service';
import { StateService } from './state.service';
import { ToolRegistryService } from './tool-registry.service';
import { PerformanceService } from '../../performance/performance.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { GraphExecutorService } from './graph-executor.service';
import { InterruptHandlerService } from './interrupt-handler.service';
import { TracingService } from './tracing.service';
import { HumanMessage } from '@langchain/core/messages';
import { GuardrailException } from '../graphs/nodes/guardrail.node';

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  let stateService: jest.Mocked<StateService>;

  const mockStateService = {
    getSaver: jest.fn(),
    scopeThreadId: jest.fn(
      (userId, threadId) => `${userId}:${threadId || 'test'}`,
    ),
    extractUserId: jest.fn(),
    extractThreadId: jest.fn(),
  };

  const mockToolRegistry = {
    getTools: jest.fn().mockReturnValue([]),
    registerTool: jest.fn(),
    getTool: jest.fn(),
    hasTool: jest.fn(),
    getToolCount: jest.fn().mockReturnValue(0),
    clearTools: jest.fn(),
  };

  const mockPerformanceService = {
    calculateInternalReturn: jest.fn(),
    getBenchmarkComparison: jest.fn(),
  };

  const mockPortfolioService = {
    getHoldingsWithSectorData: jest.fn().mockResolvedValue([]),
    getPortfolioSummary: jest.fn(),
    findOne: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  const mockTracingService = {
    recordTrace: jest.fn(),
    getTracesByThread: jest.fn().mockResolvedValue([]),
    getTracesByUser: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        GraphExecutorService,
        InterruptHandlerService,
        {
          provide: StateService,
          useValue: mockStateService,
        },
        {
          provide: ToolRegistryService,
          useValue: mockToolRegistry,
        },
        {
          provide: PerformanceService,
          useValue: mockPerformanceService,
        },
        {
          provide: PortfolioService,
          useValue: mockPortfolioService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: TracingService,
          useValue: mockTracingService,
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    stateService = module.get(StateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runGraph', () => {
    it('should execute graph with user input', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Analyze portfolio' };

      const result = await service.runGraph(userId, input);

      expect(result).toBeDefined();
      expect(result.threadId).toBeDefined();
      expect(result.finalState).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
    });

    it('should scope threadId with userId', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test' };

      await service.runGraph(userId, input);

      expect(stateService.scopeThreadId).toHaveBeenCalledWith(
        userId,
        undefined,
      );
    });

    it('should use provided threadId if given', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const threadId = 'custom-thread-id';
      const input = { message: 'Test' };

      await service.runGraph(userId, input, threadId);

      expect(stateService.scopeThreadId).toHaveBeenCalledWith(userId, threadId);
    });

    it('should convert string input to HumanMessage', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test message' };

      const result = await service.runGraph(userId, input);

      expect(result.finalState.messages).toBeDefined();
      expect(result.finalState.messages.length).toBeGreaterThan(0);
      expect(result.finalState.messages[0]).toBeInstanceOf(HumanMessage);
    });

    it('should handle graph execution errors', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      // Force an error by providing invalid input
      const input = null as unknown as { message: string };

      await expect(service.runGraph(userId, input)).rejects.toThrow();
    });

    it('should return final report in result', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test' };

      const result = await service.runGraph(userId, input);

      expect(result.finalState.final_report).toBeDefined();
      expect(result.finalState.final_report).toContain(
        'Graph Execution Complete',
      );
    });

    it('should include userId in final state', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test' };

      const result = await service.runGraph(userId, input);

      expect(result.finalState.userId).toBe(userId);
    });

    describe('User-Scoped Validation', () => {
      it('should reject execution without userId', async () => {
        const input = { message: 'Test' };

        // TypeScript would prevent this, but test runtime validation
        await expect(service.runGraph('', input)).rejects.toThrow();
      });

      it('should reject execution with null userId', async () => {
        const input = { message: 'Test' };

        await expect(
          service.runGraph(null as unknown as string, input),
        ).rejects.toThrow();
      });

      it('should reject execution with undefined userId', async () => {
        const input = { message: 'Test' };

        await expect(
          service.runGraph(undefined as unknown as string, input),
        ).rejects.toThrow();
      });
    });

    describe('Guardrail Exception Handling', () => {
      it('should handle GuardrailException gracefully', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';
        const input = { message: 'Test with high iteration' };

        // Spy on GraphExecutorService to throw GuardrailException
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const graphExecutor = (service as any).graphExecutor;
        jest
          .spyOn(graphExecutor, 'invoke')
          .mockRejectedValue(
            new GuardrailException(
              'Iteration limit reached (10/10). The agent attempted too many steps. Please simplify your request or contact support.',
            ),
          );
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

        const result = await service.runGraph(userId, input);

        expect(result).toBeDefined();
        expect(result.status).toBe('FAILED');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Iteration limit reached');
        expect(result.error).toContain('10/10');
      });

      it('should log warning when guardrail is triggered', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';
        const input = { message: 'Test' };

        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const graphExecutor = (service as any).graphExecutor;
        jest
          .spyOn(graphExecutor, 'invoke')
          .mockRejectedValue(new GuardrailException('Test guardrail message'));

        const loggerSpy = jest.spyOn((service as any).logger, 'warn');
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

        await service.runGraph(userId, input);

        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Guardrail triggered'),
        );
      });

      it('should return threadId in failed result', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';
        const input = { message: 'Test' };

        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const graphExecutor = (service as any).graphExecutor;
        jest
          .spyOn(graphExecutor, 'invoke')
          .mockRejectedValue(new GuardrailException('Test message'));
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

        const result = await service.runGraph(userId, input);

        expect(result.threadId).toBeDefined();
        expect(result.threadId).toContain(userId);
      });
    });
  });
});
