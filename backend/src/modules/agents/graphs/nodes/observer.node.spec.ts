import { observerNode } from './observer.node';
import { CIOState } from '../types';
import { HumanMessage } from '@langchain/core/messages';

describe('observerNode', () => {
  it('should initialize state and return next action', () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [new HumanMessage('Analyze my portfolio')],
      errors: [],
      iteration: 0,
      maxIterations: 5,
    };

    const result = observerNode(state);

    expect(result).toBeDefined();
    expect(result.nextAction).toBe('end');
    expect(result.iteration).toBe(1);
  });

  it('should increment iteration count', () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [],
      errors: [],
      iteration: 2,
      maxIterations: 5,
    };

    const result = observerNode(state);

    expect(result.iteration).toBe(3);
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

    const result = observerNode(state);

    expect(result).toBeDefined();
    expect(result.nextAction).toBe('end');
  });
});
