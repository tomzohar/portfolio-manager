import { HumanMessage } from '@langchain/core/messages';
import { routerNode } from './router.node';
import { CIOState } from '../types';

describe('routerNode', () => {
  const createState = (message: string): CIOState => ({
    userId: 'user-123',
    threadId: 'thread-123',
    messages: [new HumanMessage(message)],
    errors: [],
    iteration: 0,
    maxIterations: 10,
  });

  it('should route to performance_attribution for performance queries', () => {
    const state = createState('How did my portfolio perform last month?');
    const route = routerNode(state);
    expect(route).toBe('performance_attribution');
  });

  it('should route to performance_attribution for return queries', () => {
    const state = createState("What's my return this year?");
    const route = routerNode(state);
    expect(route).toBe('performance_attribution');
  });

  it('should route to performance_attribution for alpha queries', () => {
    const state = createState('Did I beat the S&P 500?');
    const route = routerNode(state);
    expect(route).toBe('performance_attribution');
  });

  it('should route to performance_attribution for YTD queries', () => {
    const state = createState('Show me my YTD performance');
    const route = routerNode(state);
    expect(route).toBe('performance_attribution');
  });

  it('should route to observer for non-performance queries', () => {
    const state = createState('What stocks should I buy?');
    const route = routerNode(state);
    expect(route).toBe('observer');
  });

  it('should route to observer for portfolio questions', () => {
    const state = createState('What are my current holdings?');
    const route = routerNode(state);
    expect(route).toBe('observer');
  });

  it('should be case insensitive', () => {
    const state = createState('SHOW ME MY PERFORMANCE');
    const route = routerNode(state);
    expect(route).toBe('performance_attribution');
  });

  describe('HITL Routing (guarded by env var)', () => {
    beforeEach(() => {
      process.env.ENABLE_HITL_TEST_NODE = 'true';
    });

    afterEach(() => {
      delete process.env.ENABLE_HITL_TEST_NODE;
    });

    it('should route to hitl_test when enabled and keywords present', () => {
      const state = createState('trigger interrupt for hitl test');
      const route = routerNode(state);
      expect(route).toBe('hitl_test');
    });

    it('should NOT route to hitl_test when disabled even if keywords present', () => {
      process.env.ENABLE_HITL_TEST_NODE = 'false';
      const state = createState('trigger interrupt for hitl test');
      const route = routerNode(state);
      expect(route).toBe('observer');
    });

    it('should route to hitl_test for "approval" keyword', () => {
      const state = createState('I need approval');
      const route = routerNode(state);
      expect(route).toBe('hitl_test');
    });
  });
});
