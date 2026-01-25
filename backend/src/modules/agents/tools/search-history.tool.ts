import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ConversationService } from '../../conversations/services/conversation.service';

/**
 * Create the search_history tool
 *
 * @param conversationService - Service to search messages
 * @returns DynamicStructuredTool for searching history
 */
// Schema Definition
export const SearchHistorySchema = z.object({
  query: z
    .string()
    .describe('The search query or keyword to look for in the history'),
  userId: z.string().describe('The user ID (provided in context)'),
  threadId: z.string().describe('The thread ID (provided in context)'),
});

/**
 * Create the search_history tool
 *
 * @param conversationService - Service to search messages
 * @returns DynamicStructuredTool for searching history
 */
export function createSearchHistoryTool(
  conversationService: ConversationService,
) {
  return new DynamicStructuredTool({
    name: 'search_history',
    description:
      'Search the conversation history. Returns structured JSON with matching messages.',
    schema: SearchHistorySchema,
    func: async ({
      query,
      userId,
      threadId,
    }: z.infer<typeof SearchHistorySchema>) => {
      try {
        const messages = await conversationService.searchMessages({
          threadId,
          userId,
          query,
          limit: 10,
        });

        const count = messages.length;

        const results = messages.map((m) => ({
          timestamp: m.createdAt.toISOString(),
          role: m.type,
          content: m.content,
        }));

        return JSON.stringify(
          {
            query,
            count,
            results,
          },
          null,
          2,
        );
      } catch (error) {
        return JSON.stringify({
          error: `Error searching history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
  });
}
