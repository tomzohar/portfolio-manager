import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PortfolioData } from '../graphs/types';

/**
 * Portfolio position schema
 */
export const PortfolioPositionSchema = z.object({
  ticker: z.string().describe('Stock ticker symbol (e.g., AAPL)'),
  price: z.number().positive().describe('Current price per share'),
  quantity: z.number().int().nonnegative().describe('Number of shares held'),
  marketValue: z
    .number()
    .nonnegative()
    .optional()
    .describe('Total value of position'),
  percentOfTotal: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Position percentage (0-100)'),
  weight: z.number().min(0).max(1).optional().describe('Position weight (0-1)'),
});

/**
 * Portfolio data schema
 */
export const PortfolioDataSchema = z.object({
  positions: z
    .array(PortfolioPositionSchema)
    .min(1)
    .optional()
    .describe('List of portfolio positions'),
  totalValue: z
    .number()
    .nonnegative()
    .optional()
    .describe('Total portfolio value'),
  name: z.string().optional().describe('Portfolio name or ID'),
  riskProfile: z
    .enum(['conservative', 'moderate', 'aggressive'])
    .optional()
    .describe('Portfolio risk profile'),
});

/**
 * Request DTO for running the CIO graph
 */
export const RunGraphSchema = z.object({
  message: z.string().min(1).describe('User message to process'),
  portfolio: PortfolioDataSchema.optional().describe('Optional portfolio data'),
  threadId: z
    .string()
    .optional()
    .describe('Optional thread ID for resuming conversation'),
});

export class RunGraphDto extends createZodDto(RunGraphSchema) {
  portfolio?: PortfolioData;
}
