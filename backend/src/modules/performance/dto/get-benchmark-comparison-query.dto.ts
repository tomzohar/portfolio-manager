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
});

/**
 * DTO for benchmark comparison query parameters
 */
export class GetBenchmarkComparisonQueryDto extends createZodDto(
  GetBenchmarkComparisonQuerySchema,
) {}
