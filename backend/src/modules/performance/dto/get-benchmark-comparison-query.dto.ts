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
});

/**
 * DTO for benchmark comparison query parameters
 */
export class GetBenchmarkComparisonQueryDto extends createZodDto(
  GetBenchmarkComparisonQuerySchema,
) {}
