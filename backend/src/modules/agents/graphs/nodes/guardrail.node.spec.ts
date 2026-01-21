import { guardrailNode, GuardrailException } from './guardrail.node';
import { CIOState } from '../types';
import { HumanMessage } from '@langchain/core/messages';

describe('guardrailNode', () => {
  const createMockState = (
    iteration: number,
    maxIterations: number,
  ): CIOState => ({
    userId: '123e4567-e89b-12d3-a456-426614174000',
    threadId: 'thread-123',
    messages: [new HumanMessage('Test message')],
    errors: [],
    iteration,
    maxIterations,
  });

  describe('when iteration is below limit', () => {
    it('should allow execution when iteration < maxIterations', () => {
      const state = createMockState(5, 10);

      const result = guardrailNode(state);

      expect(result).toBeDefined();
      // Guardrail should increment iteration counter
      expect(result.iteration).toBe(6);
    });

    it('should allow execution when iteration === maxIterations - 1 (last iteration)', () => {
      const state = createMockState(9, 10);

      const result = guardrailNode(state);

      expect(result).toBeDefined();
      expect(result.iteration).toBe(10);
    });

    it('should allow execution when iteration is 0', () => {
      const state = createMockState(0, 10);

      const result = guardrailNode(state);

      expect(result).toBeDefined();
      expect(result.iteration).toBe(1);
    });
  });

  describe('when iteration limit is reached', () => {
    it('should throw GuardrailException when iteration === maxIterations', () => {
      const state = createMockState(10, 10);

      expect(() => guardrailNode(state)).toThrow(GuardrailException);
    });

    it('should throw GuardrailException when iteration > maxIterations', () => {
      const state = createMockState(11, 10);

      expect(() => guardrailNode(state)).toThrow(GuardrailException);
    });

    it('should provide helpful error message with iteration counts', () => {
      const state = createMockState(10, 10);

      expect(() => guardrailNode(state)).toThrow(
        'Iteration limit reached (10/10). ' +
          'The agent attempted too many steps. ' +
          'Please simplify your request or contact support.',
      );
    });

    it('should throw an error with name GuardrailException', () => {
      const state = createMockState(10, 10);

      try {
        guardrailNode(state);
        fail('Expected GuardrailException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GuardrailException);
        expect((error as Error).name).toBe('GuardrailException');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle maxIterations of 1', () => {
      const state = createMockState(0, 1);

      const result = guardrailNode(state);

      expect(result).toBeDefined();
      expect(result.iteration).toBe(1);
    });

    it('should throw when iteration equals maxIterations of 1', () => {
      const state = createMockState(1, 1);

      expect(() => guardrailNode(state)).toThrow(GuardrailException);
    });

    it('should handle large iteration numbers', () => {
      const state = createMockState(999, 1000);

      const result = guardrailNode(state);

      expect(result).toBeDefined();
      expect(result.iteration).toBe(1000);
    });
  });
});
