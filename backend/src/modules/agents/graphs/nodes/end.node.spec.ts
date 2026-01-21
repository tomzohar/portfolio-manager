import { endNode } from './end.node';
import { CIOState } from '../types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('endNode', () => {
  it('should generate final report', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [
        new HumanMessage('Analyze my portfolio'),
        new AIMessage('Observer executed'),
      ],
      errors: [],
      iteration: 1,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result).toBeDefined();
    expect(result.final_report).toBeDefined();
    expect(result.final_report).toContain('Graph Execution Complete');
  });

  it('should include execution summary in report', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [
        new HumanMessage('Test message 1'),
        new AIMessage('Response 1'),
        new AIMessage('Response 2'),
      ],
      errors: [],
      iteration: 3,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result.final_report).toContain('Total iterations: 3');
    expect(result.final_report).toContain('Total messages: 3');
  });

  it('should include errors in report if present', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [],
      errors: ['Error 1', 'Error 2'],
      iteration: 1,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result.final_report).toContain('Errors encountered: 2');
    expect(result.final_report).toContain('Error 1');
    expect(result.final_report).toContain('Error 2');
  });

  it('should handle state with no errors', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [new HumanMessage('Test')],
      errors: [],
      iteration: 1,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result.final_report).toContain('No errors');
  });
});
