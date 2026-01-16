/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { buildCIOGraph } from './cio.graph';
import { CIOState } from './types';
import { HumanMessage } from '@langchain/core/messages';

// Mock the StateService
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

describe('CIO Graph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should build and compile graph', () => {
    const graph = buildCIOGraph(mockStateService as any);
    expect(graph).toBeDefined();
  });

  it('should execute from observer to end', async () => {
    const graph = buildCIOGraph(mockStateService as any);

    const initialState: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [new HumanMessage('Test input')],
      errors: [],
      iteration: 0,
      maxIterations: 5,
    };

    const result = await graph.invoke(initialState);

    expect(result).toBeDefined();
    expect(result.final_report).toBeDefined();
    expect(result.final_report).toContain('Graph Execution Complete');
    expect(result.iteration).toBeGreaterThan(0);
  });

  it('should preserve userId through execution', async () => {
    const graph = buildCIOGraph(mockStateService as any);

    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const initialState: CIOState = {
      userId,
      threadId: 'thread-123',
      messages: [],
      errors: [],
      iteration: 0,
      maxIterations: 5,
    };

    const result = await graph.invoke(initialState);

    expect(result.userId).toBe(userId);
  });

  it('should accumulate messages through nodes', async () => {
    const graph = buildCIOGraph(mockStateService as any);

    const initialState: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [new HumanMessage('Initial message')],
      errors: [],
      iteration: 0,
      maxIterations: 5,
    };

    const result = await graph.invoke(initialState);

    // Should have at least 2 messages (initial + observer response)
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle errors gracefully', async () => {
    const graph = buildCIOGraph(mockStateService as any);

    const initialState: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [],
      errors: ['Test error'],
      iteration: 0,
      maxIterations: 5,
    };

    const result = await graph.invoke(initialState);
    expect(result.final_report).toContain('Errors encountered');
    expect(result.final_report).toContain('Test error');
  });

  describe('HITL Node Inclusion', () => {
    afterEach(() => {
      delete process.env.ENABLE_HITL_TEST_NODE;
    });

    it('should NOT include hitl_test node when disabled', () => {
      process.env.ENABLE_HITL_TEST_NODE = 'false';
      const graph = buildCIOGraph(mockStateService as any);
      const nodeNames = Object.keys(graph.nodes);
      expect(nodeNames).not.toContain('hitl_test');
    });

    it('should include hitl_test node when enabled', () => {
      process.env.ENABLE_HITL_TEST_NODE = 'true';
      const graph = buildCIOGraph(mockStateService as any);
      const nodeNames = Object.keys(graph.nodes);
      expect(nodeNames).toContain('hitl_test');
    });
  });
});
