import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Timeframe } from '../types/timeframe.types';

/**
 * Zod schema for calculating portfolio returns
 */
export const CalculateReturnSchema = z.object({
  portfolioId: z.string().uuid(),
  timeframe: z.nativeEnum(Timeframe),
});

/**
 * DTO for calculating portfolio returns
 */
export class CalculateReturnDto extends createZodDto(CalculateReturnSchema) {}
