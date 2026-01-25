import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateConversationConfigSchema = z.object({
  showTraces: z
    .boolean()
    .optional()
    .describe('Whether to show reasoning traces in the UI'),
});

export class UpdateConversationConfigDto extends createZodDto(
  UpdateConversationConfigSchema,
) {}
