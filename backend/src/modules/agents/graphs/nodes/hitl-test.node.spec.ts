import { hitlTestNode } from './hitl-test.node';
import { CIOState } from '../types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { interrupt } from '@langchain/langgraph';

// Mock interrupt function
jest.mock('@langchain/langgraph', () => ({
  interrupt: jest.fn(),
}));

describe('hitlTestNode', () => {
  const mockInterrupt = interrupt as jest.MockedFunction<typeof interrupt>;

  beforeEach(() => {
    jest.clearAllMocks();
    // By default, make interrupt throw to simulate real behavior
    mockInterrupt.mockImplementation((reason: string) => {
      throw new Error(`NodeInterrupt: ${reason}`);
    });
  });

  const createMockState = (message: string): CIOState => ({
    userId: 'test-user-123',
    threadId: 'test-thread-456',
    messages: [new HumanMessage(message)],
    errors: [],
    iteration: 0,
    maxIterations: 10,
  });

  describe('Interrupt Trigger Logic', () => {
    it('should call interrupt() when message contains "interrupt"', () => {
      const state = createMockState('Please trigger interrupt');

      expect(() => hitlTestNode(state)).toThrow('NodeInterrupt');
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('human approval'),
      );
    });

    it('should call interrupt() when message contains "approval"', () => {
      const state = createMockState('Need approval for this action');

      expect(() => hitlTestNode(state)).toThrow('NodeInterrupt');
      expect(mockInterrupt).toHaveBeenCalled();
    });

    it('should call interrupt() when message contains "hitl"', () => {
      const state = createMockState('Test HITL flow');

      expect(() => hitlTestNode(state)).toThrow('NodeInterrupt');
      expect(mockInterrupt).toHaveBeenCalled();
    });

    it('should NOT call interrupt() for normal messages', () => {
      const state = createMockState('Analyze my portfolio');
      mockInterrupt.mockImplementation(() => {
        // Don't throw for this test
      });

      const result = hitlTestNode(state);

      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(result.nextAction).toBe('end');
      expect(result.messages).toBeDefined();
    });
  });

  describe('State Updates', () => {
    it('should not increment iteration (handled by guardrail)', () => {
      const state = createMockState('Normal message');
      mockInterrupt.mockImplementation(() => {
        // Don't throw
      });

      const result = hitlTestNode(state);

      // HITL test node no longer increments iteration - guardrail does this
      expect(result.iteration).toBeUndefined();
    });

    it('should return AI message when no interrupt', () => {
      const state = createMockState('Normal message');
      mockInterrupt.mockImplementation(() => {
        // Don't throw
      });

      const result = hitlTestNode(state);

      expect(result.messages).toHaveLength(1);
      expect(result.messages![0]).toBeInstanceOf(AIMessage);
      expect(result.messages![0].content).toContain(
        'completed without interrupt',
      );
    });

    it('should set nextAction to "end" when no interrupt', () => {
      const state = createMockState('Normal message');
      mockInterrupt.mockImplementation(() => {
        // Don't throw
      });

      const result = hitlTestNode(state);

      expect(result.nextAction).toBe('end');
    });
  });

  describe('Case Insensitivity', () => {
    it('should trigger interrupt for uppercase keywords', () => {
      const state = createMockState('Please INTERRUPT the flow');

      expect(() => hitlTestNode(state)).toThrow('NodeInterrupt');
      expect(mockInterrupt).toHaveBeenCalled();
    });

    it('should trigger interrupt for mixed case keywords', () => {
      const state = createMockState('Need ApPrOvAl here');

      expect(() => hitlTestNode(state)).toThrow('NodeInterrupt');
      expect(mockInterrupt).toHaveBeenCalled();
    });
  });

  describe('Interrupt Reason', () => {
    it('should provide clear interrupt reason message', () => {
      const state = createMockState('trigger interrupt');

      expect(() => hitlTestNode(state)).toThrow();
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringMatching(/human approval|review|confirm/i),
      );
    });

    it('should include actionable guidance in interrupt message', () => {
      const state = createMockState('test interrupt');

      expect(() => hitlTestNode(state)).toThrow();
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.stringContaining('Please review'),
      );
    });
  });

  describe('Message Content Handling', () => {
    it('should handle empty messages', () => {
      const state = createMockState('');
      mockInterrupt.mockImplementation(() => {
        // Don't throw
      });

      const result = hitlTestNode(state);

      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle non-string message content', () => {
      const state: CIOState = {
        userId: 'test-user-123',
        threadId: 'test-thread-456',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        messages: [
          {
            content: ['array', 'content'],
            type: 'human',
          } as any,
        ] as any[],
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      mockInterrupt.mockImplementation(() => {
        // Don't throw
      });

      const result = hitlTestNode(state);

      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
