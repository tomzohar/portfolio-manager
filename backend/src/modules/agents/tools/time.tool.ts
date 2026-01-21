import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Example tool: Get current time
 * Simple demonstration of tool creation for the CIO graph
 */
export const getCurrentTimeTool = new DynamicStructuredTool({
  name: 'get_current_time',
  description:
    'Get the current date and time in ISO format. Useful for timestamping events or understanding the current context.',
  schema: z.object({
    timezone: z
      .string()
      .optional()
      .describe(
        'Optional timezone (e.g., "America/New_York"). Defaults to UTC.',
      ),
  }),
  func: ({ timezone }) => {
    const now = new Date();

    if (timezone) {
      try {
        return Promise.resolve(
          now.toLocaleString('en-US', { timeZone: timezone }),
        );
      } catch {
        return Promise.reject(
          new Error(
            `Error: Invalid timezone "${timezone}". Current UTC time: ${now.toISOString()}`,
          ),
        );
      }
    }

    return Promise.resolve(now.toISOString());
  },
});
