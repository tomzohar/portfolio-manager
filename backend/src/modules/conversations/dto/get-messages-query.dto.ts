import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Zod schema for paginated message retrieval query parameters
 * Supports limit and cursor-based pagination via sequence numbers.
 */
export const GetMessagesQuerySchema = z.object({
  /** Maximum number of messages to return (default: 50, max: 100) */
  limit: z.coerce.number().min(1).max(100).optional().default(50),

  /** Return messages with sequence less than this value (for loading older messages) */
  beforeSequence: z.coerce.number().min(0).optional(),

  /** Return messages with sequence greater than this value (for loading newer messages) */
  afterSequence: z.coerce.number().min(0).optional(),
});

/**
 * Query DTO for paginated message retrieval.
 * Supports limit and cursor-based pagination via sequence numbers.
 */
export class GetMessagesQueryDto extends createZodDto(GetMessagesQuerySchema) {}
