import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Timeframe } from '../types/timeframe.types';

/**
 * Zod schema for historical data query parameters
 */
export const GetHistoricalDataQuerySchema = z.object({
  timeframe: z.nativeEnum(Timeframe, {
    message: `Timeframe must be one of: ${Object.values(Timeframe).join(', ')}`,
  }),
  benchmarkTicker: z.string().default('SPY').optional(),
});

/**
 * DTO for historical data query parameters
 */
export class GetHistoricalDataQueryDto extends createZodDto(
  GetHistoricalDataQuerySchema,
) {}
