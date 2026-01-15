/* eslint-disable @typescript-eslint/unbound-method */
import { withTracing } from './with-tracing';
import { TracingService } from '../../services/tracing.service';
import { CIOState } from '../types';
import { HumanMessage } from '@langchain/core/messages';

describe('withTracing middleware', () => {
  let tracingService: jest.Mocked<TracingService>;

  const mockTracingService = {
    recordTrace: jest.fn(),
  };

  beforeEach(() => {
    tracingService =
      mockTracingService as unknown as jest.Mocked<TracingService>;
    jest.clearAllMocks();
  });

  describe('withTracing() higher-order function', () => {
    it('should wrap node function and preserve its behavior', async () => {
      // Arrange
      const nodeName = 'test_node';
      const originalNode = jest.fn().mockResolvedValue({
        result: 'success',
      });

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      // Act
      const wrappedNode = withTracing(nodeName, originalNode);
      const result = await wrappedNode(state, {}, tracingService);

      // Assert
      expect(originalNode).toHaveBeenCalledWith(state, {}, tracingService);
      expect(result).toEqual({ result: 'success' });
    });

    it('should call tracingService when provided', async () => {
      // Arrange
      const nodeName = 'test_node';
      const originalNode = jest.fn().mockResolvedValue({
        result: 'success',
        reasoning: 'Test reasoning',
      });

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue({
        id: 'trace-123',
        threadId: state.threadId,
        userId: state.userId,
        nodeName,
        input: state,
        output: { result: 'success', reasoning: 'Test reasoning' },
        reasoning: 'Test reasoning',
        createdAt: new Date(),
      } as any);

      // Act
      const wrappedNode = withTracing(nodeName, originalNode);
      await wrappedNode(state, {}, tracingService);

      // Assert
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        state.threadId,
        state.userId,
        nodeName,
        state,
        { result: 'success', reasoning: 'Test reasoning' },
        'Test reasoning',
      );
    });

    it('should extract custom reasoning message from node output', async () => {
      // Arrange
      const nodeName = 'performance_attribution';
      const customReasoning =
        'Portfolio underperformed due to tech sector exposure';

      const originalNode = jest.fn().mockResolvedValue({
        alpha: -0.06,
        reasoning: customReasoning,
      });

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      const wrappedNode = withTracing(nodeName, originalNode);
      await wrappedNode(state, {}, tracingService);

      // Assert
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        state.threadId,
        state.userId,
        nodeName,
        state,
        { alpha: -0.06, reasoning: customReasoning },
        customReasoning,
      );
    });

    it('should use default reasoning when no custom reasoning in output', async () => {
      // Arrange
      const nodeName = 'observer';
      const originalNode = jest.fn().mockResolvedValue({
        context: 'Portfolio data retrieved',
      });

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      const wrappedNode = withTracing(nodeName, originalNode);
      await wrappedNode(state, {}, tracingService);

      // Assert
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        state.threadId,
        state.userId,
        nodeName,
        state,
        { context: 'Portfolio data retrieved' },
        `Executed node: ${nodeName}`, // Default reasoning
      );
    });

    it('should handle nodes that return undefined', async () => {
      // Arrange
      const nodeName = 'test_node';
      const originalNode = jest.fn().mockResolvedValue(undefined);

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      const wrappedNode = withTracing(nodeName, originalNode);
      const result = await wrappedNode(state, {}, tracingService);

      // Assert
      expect(result).toBeUndefined();
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        state.threadId,
        state.userId,
        nodeName,
        state,
        undefined,
        `Executed node: ${nodeName}`,
      );
    });

    it('should not call tracingService when not provided', async () => {
      // Arrange
      const nodeName = 'test_node';
      const originalNode = jest.fn().mockResolvedValue({
        result: 'success',
      });

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      // Act
      const wrappedNode = withTracing(nodeName, originalNode);
      const result = await wrappedNode(state, {}, undefined);

      // Assert
      expect(originalNode).toHaveBeenCalledWith(state, {}, undefined);
      expect(result).toEqual({ result: 'success' });
      expect(tracingService.recordTrace).not.toHaveBeenCalled();
    });

    it('should handle errors in original node gracefully', async () => {
      // Arrange
      const nodeName = 'test_node';
      const error = new Error('Node execution failed');
      const originalNode = jest.fn().mockRejectedValue(error);

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      // Act & Assert
      const wrappedNode = withTracing(nodeName, originalNode);
      await expect(wrappedNode(state, {}, tracingService)).rejects.toThrow(
        'Node execution failed',
      );

      // tracingService should not be called on error
      expect(tracingService.recordTrace).not.toHaveBeenCalled();
    });

    it('should handle errors in tracingService gracefully', async () => {
      // Arrange
      const nodeName = 'test_node';
      const originalNode = jest.fn().mockResolvedValue({
        result: 'success',
      });

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act - Should not throw even if tracing fails
      const wrappedNode = withTracing(nodeName, originalNode);
      const result = await wrappedNode(state, {}, tracingService);

      // Assert - Original node result should still be returned
      expect(result).toEqual({ result: 'success' });
    });
  });

  describe('integration with real node functions', () => {
    it('should work with observer node pattern', async () => {
      // Arrange
      const observerNode = jest.fn().mockResolvedValue({
        context: 'User has 3 portfolios',
        reasoning: 'Retrieved portfolio context from database',
      });

      const state: CIOState = {
        messages: [new HumanMessage('Show my portfolios')],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      const wrappedObserver = withTracing('observer', observerNode);
      const result = await wrappedObserver(state, {}, tracingService);

      // Assert
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).reasoning).toBe(
        'Retrieved portfolio context from database',
      );
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        'thread-123',
        'user-456',
        'observer',
        state,
        result,
        'Retrieved portfolio context from database',
      );
    });

    it('should work with performance attribution node pattern', async () => {
      // Arrange
      const performanceNode = jest.fn().mockResolvedValue({
        alpha: -0.06,
        beta: 1.2,
        reasoning:
          'Portfolio underperformed by 6% vs benchmark due to tech overweight',
      });

      const state: CIOState = {
        messages: [new HumanMessage('How did I perform?')],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      const wrappedPerformance = withTracing(
        'performance_attribution',
        performanceNode,
      );
      const result = await wrappedPerformance(state, {}, tracingService);

      // Assert
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).alpha).toBe(-0.06);
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        'thread-123',
        'user-456',
        'performance_attribution',
        state,
        result,
        'Portfolio underperformed by 6% vs benchmark due to tech overweight',
      );
    });

    it('should work with end node pattern', async () => {
      // Arrange
      const endNode = jest.fn().mockResolvedValue({
        response: 'Your portfolio gained 5% last month.',
        reasoning: 'Generated final response based on analysis',
      });

      const state: CIOState = {
        messages: [new HumanMessage('Summary?')],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      const wrappedEnd = withTracing('end', endNode);
      const result = await wrappedEnd(state, {}, tracingService);

      // Assert
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).response).toBe(
        'Your portfolio gained 5% last month.',
      );
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        'thread-123',
        'user-456',
        'end',
        state,
        result,
        'Generated final response based on analysis',
      );
    });
  });

  describe('future-proof architecture', () => {
    it('should support adding new nodes without code changes', async () => {
      // Arrange - Simulate a brand new node added to the graph
      const newRiskAnalysisNode = jest.fn().mockResolvedValue({
        riskScore: 0.85,
        reasoning: 'Portfolio has high concentration risk in tech sector',
      });

      const state: CIOState = {
        messages: [new HumanMessage('What are my risks?')],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act - Just wrap with withTracing and it works
      const wrappedRiskNode = withTracing('risk_analysis', newRiskAnalysisNode);
      const result = await wrappedRiskNode(state, {}, tracingService);

      // Assert - New node gets automatic tracing
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).riskScore).toBe(0.85);
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        'thread-123',
        'user-456',
        'risk_analysis',
        state,
        result,
        'Portfolio has high concentration risk in tech sector',
      );
    });

    it('should support nodes without custom reasoning', async () => {
      // Arrange - Node that just transforms data without explanation
      const dataTransformNode = jest.fn().mockResolvedValue({
        transformedData: { value: 100 },
      });

      const state: CIOState = {
        messages: [],
        threadId: 'thread-123',
        userId: 'user-456',
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockTracingService.recordTrace.mockResolvedValue(undefined as any);

      // Act
      const wrappedNode = withTracing('data_transform', dataTransformNode);
      await wrappedNode(state, {}, tracingService);

      // Assert - Uses default reasoning
      expect(tracingService.recordTrace).toHaveBeenCalledWith(
        'thread-123',
        'user-456',
        'data_transform',
        state,
        { transformedData: { value: 100 } },
        'Executed node: data_transform',
      );
    });
  });
});
