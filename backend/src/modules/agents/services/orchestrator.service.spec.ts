/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService } from './orchestrator.service';
import { StateService } from './state.service';
import { ToolRegistryService } from './tool-registry.service';
import { HumanMessage } from '@langchain/core/messages';

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        {
          provide: StateService,
          useValue: mockStateService,
        },
        {
          provide: ToolRegistryService,
          useValue: mockToolRegistry,
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
      const input = null;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(service.runGraph(userId, input as any)).rejects.toThrow();
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
  });
});
