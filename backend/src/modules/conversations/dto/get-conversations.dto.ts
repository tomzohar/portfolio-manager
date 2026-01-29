import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetConversationsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().min(1).optional())
    .describe('Limit the number of conversations'),
});

export class GetConversationsDto extends createZodDto(GetConversationsSchema) {}
