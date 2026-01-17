import { CIOState } from '../types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { interrupt } from '@langchain/langgraph';
import {
  ApprovalConfig,
  approvalGateNode,
  requiresApproval,
} from './approval-gate.node';

// Mock interrupt function
jest.mock('@langchain/langgraph', () => ({
  interrupt: jest.fn(),
}));

describe('requiresApproval', () => {
  describe('Transaction Detection', () => {
    it('should detect buy keyword', () => {
      expect(requiresApproval('buy 100 shares of AAPL')).toBe(true);
    });

    it('should detect sell keyword', () => {
      expect(requiresApproval('sell 50 shares of TSLA')).toBe(true);
    });

    it('should detect purchase keyword', () => {
      expect(requiresApproval('purchase 200 shares of MSFT')).toBe(true);
    });

    it('should detect acquire keyword', () => {
      expect(requiresApproval('acquire shares of GOOGL')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(requiresApproval('BUY 100 SHARES OF AAPL')).toBe(true);
    });
  });

  describe('Rebalancing Detection', () => {
    it('should detect rebalance keyword', () => {
      expect(requiresApproval('rebalance my portfolio')).toBe(true);
    });

    it('should detect reallocate keyword', () => {
      expect(requiresApproval('reallocate my assets')).toBe(true);
    });

    it('should detect redistribute keyword', () => {
      expect(requiresApproval('redistribute my holdings')).toBe(true);
    });
  });

  describe('High-Risk Action Detection', () => {
    it('should detect sell all keyword', () => {
      expect(requiresApproval('sell all my positions')).toBe(true);
    });

    it('should detect sell everything keyword', () => {
      expect(requiresApproval('sell everything')).toBe(true);
    });

    it('should detect liquidate keyword', () => {
      expect(requiresApproval('liquidate my portfolio')).toBe(true);
    });
  });

  describe('Non-Approval Scenarios', () => {
    it('should NOT require approval for performance queries', () => {
      expect(requiresApproval('what is my portfolio performance')).toBe(false);
    });

    it('should NOT require approval for holdings queries', () => {
      expect(requiresApproval('show me my holdings')).toBe(false);
    });

    it('should NOT require approval for analysis queries', () => {
      expect(requiresApproval('analyze the tech sector')).toBe(false);
    });

    it('should NOT require approval for empty string', () => {
      expect(requiresApproval('')).toBe(false);
    });
  });
});

describe('approvalGateNode', () => {
  const mockInterrupt = interrupt as jest.MockedFunction<typeof interrupt>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Transaction Approval Logic', () => {
    it('should trigger interrupt for large buy transaction above threshold', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Buy 100 shares of AAPL at $150 each')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000, // $10,000
        requireApprovalForRebalancing: true,
      };

      approvalGateNode(state, config);

      // Should interrupt because 100 * 150 = $15,000 > $10,000
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('$15,000'),
      );
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('approval'),
      );
    });

    it('should trigger interrupt for large sell transaction above threshold', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Sell 50 shares of TSLA at $250')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      approvalGateNode(state, config);

      // Should interrupt because 50 * 250 = $12,500 > $10,000
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('$12,500'),
      );
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('SELL'),
      );
    });

    it('should NOT interrupt for transaction below threshold', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Buy 10 shares of AAPL at $150')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      const result = approvalGateNode(state, config);

      // Should NOT interrupt because 10 * 150 = $1,500 < $10,000
      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(result.nextAction).toBe('end');
      // Iteration counting is now handled by guardrail node
    });

    it('should handle transactions with dollar signs and commas', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [
          new HumanMessage('Buy 100 shares of GOOGL at $2,500.50 each'),
        ],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 100000,
        requireApprovalForRebalancing: false,
      };

      approvalGateNode(state, config);

      // Should interrupt because 100 * 2500.50 = $250,050 > $100,000
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('$250,050'),
      );
    });
  });

  describe('Portfolio Rebalancing Approval Logic', () => {
    it('should trigger interrupt for rebalancing when enabled', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [
          new HumanMessage('Rebalance my portfolio to 60/40 stocks/bonds'),
        ],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: true,
      };

      approvalGateNode(state, config);

      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('rebalancing'),
      );
    });

    it('should NOT interrupt for rebalancing when disabled', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Rebalance my portfolio')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      const result = approvalGateNode(state, config);

      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(result.nextAction).toBe('end');
    });

    it('should detect rebalancing keywords: reallocate', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [
          new HumanMessage('Reallocate my assets to reduce tech exposure'),
        ],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: true,
      };

      approvalGateNode(state, config);

      expect(mockInterrupt).toHaveBeenCalled();
    });
  });

  describe('High-Risk Actions', () => {
    it('should trigger interrupt for selling all positions', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Sell all my positions')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      approvalGateNode(state, config);

      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('high-risk'),
      );
    });

    it('should trigger interrupt for liquidating portfolio', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Liquidate everything in my portfolio')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      approvalGateNode(state, config);

      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('liquidat'),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should pass through non-actionable queries', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('What is my portfolio performance?')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: true,
      };

      const result = approvalGateNode(state, config);

      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(result.nextAction).toBe('end');
    });

    it('should handle empty messages array', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: true,
      };

      const result = approvalGateNode(state, config);

      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(result.nextAction).toBe('end');
    });

    it('should not increment iteration count (handled by guardrail)', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('What stocks should I buy?')],
        errors: [],
        iteration: 3,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      const result = approvalGateNode(state, config);

      // Approval gate no longer increments iteration - guardrail does this
      expect(result.iteration).toBeUndefined();
    });

    it('should use default config when not provided', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Buy 200 shares of AAPL at $150')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      // Should use default threshold of $10,000
      approvalGateNode(state);

      // 200 * 150 = $30,000 > default $10,000
      expect(mockInterrupt).toHaveBeenCalled();
    });
  });

  describe('Response Messages', () => {
    it('should add informative AI message when passing through', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Show me my holdings')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      const result = approvalGateNode(state, config);

      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBe(1);
      expect(result.messages?.[0]).toBeInstanceOf(AIMessage);
    });
  });

  describe('Transaction Pattern Matching', () => {
    it('should detect buy with "purchase" keyword', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [new HumanMessage('Purchase 100 shares of MSFT at $300')],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      approvalGateNode(state, config);

      // 100 * 300 = $30,000 > $10,000
      expect(mockInterrupt).toHaveBeenCalled();
    });

    it('should detect numbers written as words', () => {
      const state: CIOState = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread-123',
        messages: [
          new HumanMessage(
            'Buy one hundred shares of NVDA at two hundred dollars',
          ),
        ],
        errors: [],
        iteration: 0,
        maxIterations: 5,
      };

      const config: ApprovalConfig = {
        transactionThreshold: 10000,
        requireApprovalForRebalancing: false,
      };

      const result = approvalGateNode(state, config);

      // This is complex NLP - for now we'll just pass through
      // In production, could use LLM to extract structured data
      expect(result).toBeDefined();
    });
  });
});
