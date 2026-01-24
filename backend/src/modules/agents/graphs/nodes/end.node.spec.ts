import { endNode } from './end.node';
import { CIOState } from '../types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('endNode', () => {
  it('should extract final report from last AI message', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [
        new HumanMessage('Analyze my portfolio'),
        new AIMessage('Here is my comprehensive analysis of your portfolio...'),
      ],
      errors: [],
      iteration: 1,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result).toBeDefined();
    expect(result.final_report).toBeDefined();
    expect(result.final_report).toBe(
      'Here is my comprehensive analysis of your portfolio...',
    );
  });

  it('should use last AI message when multiple exist', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [
        new HumanMessage('Test message 1'),
        new AIMessage('Response 1'),
        new AIMessage('Response 2'),
        new AIMessage('Final response with analysis'),
      ],
      errors: [],
      iteration: 3,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result.final_report).toBe('Final response with analysis');
  });

  it('should generate fallback report when errors present and no AI messages', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [],
      errors: ['Error 1', 'Error 2'],
      iteration: 1,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result.final_report).toContain('Error 1');
    expect(result.final_report).toContain('Error 2');
    expect(result.final_report).toContain('CIO GRAPH EXECUTION REPORT');
  });

  it('should generate fallback report when no AI messages exist', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [new HumanMessage('Test')],
      errors: [],
      iteration: 1,
      maxIterations: 5,
    };

    const result = await endNode(state);

    expect(result.final_report).toContain('CIO GRAPH EXECUTION REPORT');
    expect(result.final_report).toContain('No AI response generated');
  });

  it('should handle empty or short AI message content', async () => {
    const state: CIOState = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      threadId: 'thread-123',
      messages: [new HumanMessage('Test'), new AIMessage('')],
      errors: [],
      iteration: 1,
      maxIterations: 5,
    };

    const result = await endNode(state);

    // Should fall back to summary report when AI message is too short
    expect(result.final_report).toContain('CIO GRAPH EXECUTION REPORT');
  });
});
