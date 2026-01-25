import { createSearchHistoryTool } from './search-history.tool';
import { ConversationService } from '../../conversations/services/conversation.service';
import { DynamicStructuredTool } from '@langchain/core/tools';

describe('search_history tool', () => {
  let tool: DynamicStructuredTool;
  let mockConversationService: Partial<ConversationService>;

  beforeEach(() => {
    mockConversationService = {
      searchMessages: jest.fn(),
    };
    tool = createSearchHistoryTool(
      mockConversationService as ConversationService,
    );
  });

  it('should return structured JSON results', async () => {
    const mockMessages = [
      {
        createdAt: new Date('2023-01-01T12:00:00Z'),
        type: 'user',
        content: 'I like AAPL',
      },
      {
        createdAt: new Date('2023-01-01T12:01:00Z'),
        type: 'ai',
        content: 'Noted AAPL',
      },
    ];

    (mockConversationService.searchMessages as jest.Mock).mockResolvedValue(
      mockMessages,
    );

    const resultStr = (await tool.func({
      query: 'AAPL',
      userId: 'u1',
      threadId: 't1',
    })) as string;

    type ResultsArray = { role: string; content: string; timestamp: string };
    const result = JSON.parse(resultStr) as {
      query: string;
      count: number;
      results: ResultsArray[];
    };

    expect(result.query).toBe('AAPL');
    expect(result.count).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].role).toBe('user');
    expect(result.results[0].content).toBe('I like AAPL');
    expect(result.results[0].timestamp).toBe('2023-01-01T12:00:00.000Z');
  });

  it('should handle errors gracefully', async () => {
    (mockConversationService.searchMessages as jest.Mock).mockRejectedValue(
      new Error('DB Error'),
    );

    const resultStr = (await tool.func({
      query: 'AAPL',
      userId: 'u1',
      threadId: 't1',
    })) as string;

    const result = JSON.parse(resultStr) as { error: string };
    expect(result.error).toContain('DB Error');
  });
});
