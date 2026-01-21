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

  it('should route to reasoning for analysis queries', () => {
    const state = createState('Provide a detailed analysis of the tech sector');
    const route = routerNode(state);
    expect(route).toBe('reasoning');
  });

  it('should route to reasoning for market outlook queries', () => {
    const state = createState('What is the market outlook today?');
    const route = routerNode(state);
    expect(route).toBe('reasoning');
  });

  it('should route to reasoning for sector analysis queries', () => {
    const state = createState('Analyze the financial services sector');
    const route = routerNode(state);
    expect(route).toBe('reasoning');
  });

  it('should route to reasoning for detailed insight queries', () => {
    const state = createState('Give me insights on technology stocks');
    const route = routerNode(state);
    expect(route).toBe('reasoning');
  });

  it('should route to observer for simple queries without analysis keywords', () => {
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

  describe('Approval Gate Routing (guarded by env var)', () => {
    beforeEach(() => {
      process.env.ENABLE_APPROVAL_GATE = 'true';
    });

    afterEach(() => {
      delete process.env.ENABLE_APPROVAL_GATE;
    });

    it('should route to approval_gate for buy transactions', () => {
      const state = createState('Buy 100 shares of AAPL at $150');
      const route = routerNode(state);
      expect(route).toBe('approval_gate');
    });

    it('should route to approval_gate for sell transactions', () => {
      const state = createState('Sell 50 shares of TSLA');
      const route = routerNode(state);
      expect(route).toBe('approval_gate');
    });

    it('should route to approval_gate for purchase keyword', () => {
      const state = createState('Purchase 200 shares of MSFT');
      const route = routerNode(state);
      expect(route).toBe('approval_gate');
    });

    it('should route to approval_gate for rebalancing', () => {
      const state = createState('Rebalance my portfolio to 60/40');
      const route = routerNode(state);
      expect(route).toBe('approval_gate');
    });

    it('should route to approval_gate for reallocation', () => {
      const state = createState('Reallocate my assets');
      const route = routerNode(state);
      expect(route).toBe('approval_gate');
    });

    it('should route to approval_gate for high-risk "sell all"', () => {
      const state = createState('Sell all my positions');
      const route = routerNode(state);
      expect(route).toBe('approval_gate');
    });

    it('should route to approval_gate for liquidation', () => {
      const state = createState('Liquidate my portfolio');
      const route = routerNode(state);
      expect(route).toBe('approval_gate');
    });

    it('should NOT route to approval_gate when disabled', () => {
      process.env.ENABLE_APPROVAL_GATE = 'false';
      const state = createState('Buy 100 shares of AAPL');
      const route = routerNode(state);
      // Should route to observer (simple query without analysis keywords)
      expect(route).toBe('observer');
    });

    it('should prioritize approval_gate over other routes when enabled', () => {
      const state = createState('Buy AAPL and analyze the tech sector');
      const route = routerNode(state);
      // Transaction keywords should trigger approval gate first
      expect(route).toBe('approval_gate');
    });
  });

  describe('HITL Test Routing (guarded by env var)', () => {
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

    it('should prioritize approval_gate over hitl_test when both enabled', () => {
      process.env.ENABLE_APPROVAL_GATE = 'true';
      const state = createState('Buy AAPL - need approval for this');
      const route = routerNode(state);
      // Approval gate should take precedence
      expect(route).toBe('approval_gate');
    });
  });
});
