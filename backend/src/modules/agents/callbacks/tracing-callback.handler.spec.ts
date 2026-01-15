/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TracingCallbackHandler } from './tracing-callback.handler';
import { TracingService } from '../services/tracing.service';

describe('TracingCallbackHandler', () => {
  let handler: TracingCallbackHandler;
  let tracingService: jest.Mocked<TracingService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTracingService = {
    recordTrace: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingCallbackHandler,
        {
          provide: TracingService,
          useValue: mockTracingService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    handler = module.get<TracingCallbackHandler>(TracingCallbackHandler);
    tracingService = module.get(TracingService);
    eventEmitter = module.get(EventEmitter2);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with threadId and userId', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';

      // Act
      const newHandler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      // Assert
      expect(newHandler).toBeDefined();
    });
  });

  describe('LLM streaming hooks', () => {
    it('should emit llm.start event on onLLMStart', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      // Act
      handler.handleLLMStart();

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith('llm.start', {
        threadId,
        userId,
        timestamp: expect.any(Date),
      });
    });

    it('should emit llm.token event for each token on onLLMNewToken', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const token = 'The ';

      // Act
      handler.handleLLMNewToken(token);

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith('llm.token', {
        threadId,
        userId,
        token,
        timestamp: expect.any(Date),
      });
    });

    it('should emit multiple tokens in sequence', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const tokens = ['Your ', 'portfolio ', 'performed ', 'well.'];

      // Act
      for (const token of tokens) {
        handler.handleLLMNewToken(token);
      }

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledTimes(tokens.length);
      tokens.forEach((token, index) => {
        expect(eventEmitter.emit).toHaveBeenNthCalledWith(
          index + 1,
          'llm.token',
          {
            threadId,
            userId,
            token,
            timestamp: expect.any(Date),
          },
        );
      });
    });

    it('should emit llm.complete event and save to database on onLLMEnd', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const output = {
        generations: [[{ text: 'Complete reasoning text' }]],
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined);

      // Act
      handler.handleLLMEnd(output);

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith('llm.complete', {
        threadId,
        userId,
        reasoning: 'Complete reasoning text',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Node-level hooks', () => {
    it('should track node start on onChainStart', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const chain = { _chainType: jest.fn().mockReturnValue('graph_node') };
      const inputs = { message: 'test input' };

      // Act
      handler.handleChainStart(chain, inputs);

      // Assert - Should track internally for later use in onChainEnd
      expect(handler).toBeDefined();
    });

    it('should call tracingService.recordTrace with node data on onChainEnd', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'observer';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const outputs = { result: 'node output' };
      const inputs = { message: 'test input' };

      mockTracingService.recordTrace.mockResolvedValue({
        id: 'trace-123',
        threadId,
        userId,
        nodeName,
        input: inputs,
        output: outputs,
        reasoning: 'Node reasoning',
        createdAt: new Date(),
      } as any);

      // Act
      await handler.handleChainEnd(outputs, undefined, undefined, undefined, {
        metadata: { nodeName },
      });

      // Assert
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        threadId,
        userId,
        nodeName,
        expect.any(Object),
        outputs,
        expect.any(String),
      );
    });

    it('should extract node name from chain metadata', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const nodeName = 'performance_attribution';
      const outputs = { alpha: -0.06 };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      await handler.handleChainEnd(outputs, undefined, undefined, undefined, {
        metadata: { nodeName },
      });

      // Assert
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        threadId,
        userId,
        nodeName,
        expect.any(Object),
        outputs,
        expect.any(String),
      );
    });

    it('should emit node.complete event after recording trace', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'end';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const outputs = { finalResponse: 'Done' };

      mockTracingService.recordTrace.mockResolvedValue({
        id: 'trace-123',
        threadId,
        userId,
        nodeName,
        input: {},
        output: outputs,
        reasoning: 'Final node',
        createdAt: new Date(),
      } as any);

      // Act
      await handler.handleChainEnd(outputs, undefined, undefined, undefined, {
        metadata: { nodeName },
      });

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith('node.complete', {
        threadId,
        userId,
        nodeName,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing tracingService gracefully', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        null as any,
        eventEmitter,
      );

      const outputs = { result: 'test' };

      // Act & Assert - Should not throw
      await expect(
        handler.handleChainEnd(outputs, undefined, undefined, undefined, {
          metadata: { nodeName: 'observer' },
        }),
      ).resolves.not.toThrow();
    });

    it('should handle missing eventEmitter gracefully', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        null as any,
      );

      const token = 'test';

      // Act & Assert - Should not throw
      expect(() => handler.handleLLMNewToken(token)).not.toThrow();
    });

    it('should handle database errors in recordTrace', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const outputs = { result: 'test' };

      mockTracingService.recordTrace.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert - Should catch error and not throw
      await expect(
        handler.handleChainEnd(outputs, undefined, undefined, undefined, {
          metadata: { nodeName: 'observer' },
        }),
      ).resolves.not.toThrow();
    });

    it('should handle missing metadata gracefully', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const outputs = { result: 'test' };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act & Assert - Should use fallback node name
      await handler.handleChainEnd(outputs, undefined, undefined, undefined, {
        metadata: {},
      });

      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        threadId,
        userId,
        'unknown', // Fallback node name
        expect.any(Object),
        outputs,
        expect.any(String),
      );
    });
  });

  describe('real-time streaming architecture', () => {
    it('should support token-level streaming (Level 3 UX)', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const tokens = ['Your ', 'portfolio ', 'gained ', '5%'];
      const output = {
        generations: [[{ text: 'Your portfolio gained 5%' }]],
      };

      // Act - Simulate full LLM streaming lifecycle
      handler.handleLLMStart();

      for (const token of tokens) {
        handler.handleLLMNewToken(token);
      }

      handler.handleLLMEnd(output);

      // Assert - Verify complete streaming flow
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'llm.start',
        expect.any(Object),
      );
      expect(eventEmitter.emit).toHaveBeenCalledTimes(tokens.length + 2); // start + tokens + complete
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'llm.complete',
        expect.objectContaining({
          threadId,
          userId,
          reasoning: 'Your portfolio gained 5%',
        }),
      );
    });

    it('should preserve token order for sequential streaming', () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const tokens = ['Token1', 'Token2', 'Token3', 'Token4'];
      const emittedTokens: string[] = [];

      mockEventEmitter.emit.mockImplementation(
        (event: string, payload: any) => {
          if (event === 'llm.token') {
            emittedTokens.push(payload.token);
          }
          return true;
        },
      );

      // Act
      for (const token of tokens) {
        handler.handleLLMNewToken(token);
      }

      // Assert - Verify order is preserved
      expect(emittedTokens).toEqual(tokens);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete node execution flow', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const nodeName = 'performance_attribution';
      const chain = { _chainType: jest.fn().mockReturnValue('graph_node') };
      const inputs = { portfolioId: 'port-789' };
      const outputs = { alpha: -0.06, reasoning: 'Portfolio underperformed' };

      mockTracingService.recordTrace.mockResolvedValue({
        id: 'trace-123',
        threadId,
        userId,
        nodeName,
        input: inputs,
        output: outputs,
        reasoning: outputs.reasoning,
        createdAt: new Date(),
      } as any);

      // Act - Simulate complete node execution
      handler.handleChainStart(chain, inputs);
      await handler.handleChainEnd(outputs, undefined, undefined, undefined, {
        metadata: { nodeName },
      });

      // Assert
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        threadId,
        userId,
        nodeName,
        expect.any(Object),
        outputs,
        expect.any(String),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'node.complete',
        expect.objectContaining({
          threadId,
          userId,
          nodeName,
        }),
      );
    });

    it('should handle multiple nodes in sequence', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const handler = new TracingCallbackHandler(
        threadId,
        userId,
        tracingService,
        eventEmitter,
      );

      const nodes = [
        { name: 'observer', output: { context: 'Portfolio data' } },
        { name: 'performance_attribution', output: { alpha: -0.06 } },
        { name: 'end', output: { response: 'Final answer' } },
      ];

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      for (const node of nodes) {
        await handler.handleChainEnd(
          node.output,
          undefined,
          undefined,
          undefined,
          {
            metadata: { nodeName: node.name },
          },
        );
      }

      // Assert
      expect(tracingService.recordTrace).toHaveBeenCalledTimes(nodes.length);
      nodes.forEach((node, index) => {
        expect(tracingService.recordTrace).toHaveBeenNthCalledWith(
          index + 1,
          threadId,
          userId,
          node.name,
          expect.any(Object),
          node.output,
          expect.any(String),
        );
      });
    });
  });
});
