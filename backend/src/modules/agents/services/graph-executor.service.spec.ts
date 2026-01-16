import { Test, TestingModule } from '@nestjs/testing';
import { GraphExecutorService } from './graph-executor.service';
import { StateService } from './state.service';
import { HumanMessage } from '@langchain/core/messages';

describe('GraphExecutorService', () => {
  let service: GraphExecutorService;
  let stateService: jest.Mocked<StateService>;

  const mockStateService = {
    getSaver: jest.fn(() => {
      throw new Error('No checkpointer in unit tests');
    }),
    scopeThreadId: jest.fn(
      (userId, threadId) => `${userId}:${threadId || 'test'}`,
    ),
    extractUserId: jest.fn(),
    extractThreadId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphExecutorService,
        {
          provide: StateService,
          useValue: mockStateService,
        },
      ],
    }).compile();

    service = module.get<GraphExecutorService>(GraphExecutorService);
    stateService = module.get(StateService);
  });

  describe('getGraph', () => {
    it('should build graph on first call', () => {
      const graph = service.getGraph();

      expect(graph).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(stateService.getSaver).toHaveBeenCalled();
    });

    it('should return cached graph on subsequent calls', () => {
      const graph1 = service.getGraph();
      const graph2 = service.getGraph();

      expect(graph1).toBe(graph2);
      // getSaver should only be called once during first build
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(stateService.getSaver).toHaveBeenCalledTimes(1);
    });
  });

  describe('invoke', () => {
    it('should execute graph with initial state', async () => {
      const initialState = {
        userId: 'user-123',
        threadId: 'thread-123',
        messages: [new HumanMessage('test message')],
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      const config = {
        configurable: {
          thread_id: 'thread-123',
        },
        recursionLimit: 25,
      };

      const result = await service.invoke(initialState, config);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.messages.length).toBeGreaterThan(0);
    });
  });

  describe('getState', () => {
    it('should throw error when no checkpointer is set', async () => {
      const config = {
        configurable: {
          thread_id: 'non-existent-thread',
        },
        recursionLimit: 25,
      };

      // Without checkpointer, getState throws GraphValueError
      await expect(service.getState(config)).rejects.toThrow(
        'No checkpointer set',
      );
    });
  });

  describe('addUserInput', () => {
    it('should call updateState with HumanMessage', async () => {
      const config = {
        configurable: {
          thread_id: 'thread-123',
        },
        recursionLimit: 25,
      };

      const updateStateSpy = jest
        .spyOn(service, 'updateState')
        .mockResolvedValue();

      await service.addUserInput(config, 'User response');

      expect(updateStateSpy).toHaveBeenCalledWith(config, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: 'User response',
          }),
        ]),
      });
    });
  });
});
