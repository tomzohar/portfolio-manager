import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Timeframe } from '../types/timeframe.types';

/**
 * Zod schema for benchmark comparison query parameters
 */
export const GetBenchmarkComparisonQuerySchema = z.object({
  timeframe: z.nativeEnum(Timeframe, {
    message: `Timeframe must be one of: ${Object.values(Timeframe).join(', ')}`,
  }),
  benchmarkTicker: z.string().default('SPY').optional(),
  excludeCash: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .transform((val) => {
      if (val === undefined || val === null) return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true' || val === '1';
      }
      return false;
    }),
  asOfDate: z
    .string()
    .datetime()
    .optional()
    .describe(
      'ISO datetime string for historical analysis (e.g., "2024-01-11T00:00:00.000Z"). ' +
        'When provided, calculations use this date instead of current date. ' +
        'Useful for backtesting, tax reporting, and analyzing historical portfolio performance. ' +
        'For YTD: Uses the year of asOfDate (e.g., asOfDate=2025-06-30 returns Jan 1, 2025 to Jun 30, 2025). ' +
        'For other timeframes: Uses asOfDate as the end date instead of current date. ' +
        'This enables historical reproducibility for audit compliance and tax reporting (PRD Section 2.2.5).',
    ),
});

/**
 * DTO for benchmark comparison query parameters
 */
export class GetBenchmarkComparisonQueryDto extends createZodDto(
  GetBenchmarkComparisonQuerySchema,
) {}
