import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Request DTO for portfolio snapshot backfill
 *
 * Allows users to trigger recalculation of daily performance snapshots
 * for a portfolio, either from portfolio inception or a specific date.
 */
const BackfillRequestSchema = z.object({
  /**
   * Start date for backfill (ISO datetime string)
   * If not provided, defaults to the portfolio's earliest transaction date
   */
  startDate: z.string().datetime().optional(),

  /**
   * Force recalculation even if snapshots already exist
   * Defaults to false to prevent accidental overwrites
   */
  force: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val;
    }),
});

export class BackfillRequestDto extends createZodDto(BackfillRequestSchema) {}
