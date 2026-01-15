import { ApiProperty } from '@nestjs/swagger';
import { Timeframe } from '../types/timeframe.types';

/**
 * Response DTO for benchmark comparison results
 */
export class BenchmarkComparisonDto {
  @ApiProperty({ description: 'Portfolio return percentage (as decimal)' })
  portfolioReturn: number;

  @ApiProperty({ description: 'Benchmark return percentage (as decimal)' })
  benchmarkReturn: number;

  @ApiProperty({ description: 'Alpha: Portfolio return - Benchmark return' })
  alpha: number;

  @ApiProperty({ description: 'Benchmark ticker symbol (e.g., SPY)' })
  benchmarkTicker: string;

  @ApiProperty({ description: 'Timeframe of analysis', enum: Timeframe })
  timeframe: Timeframe;

  @ApiProperty({
    description:
      'Portfolio period return (actual gain for the period, as decimal)',
    example: 0.025,
    required: false,
  })
  portfolioPeriodReturn?: number;

  @ApiProperty({
    description:
      'Benchmark period return (actual gain for the period, as decimal)',
    example: 0.015,
    required: false,
  })
  benchmarkPeriodReturn?: number;

  @ApiProperty({
    description: 'Number of days in the analysis period',
    example: 30,
    required: false,
  })
  periodDays?: number;

  @ApiProperty({
    description: 'Warning message for short timeframes',
    example:
      'Returns for periods less than 90 days are annualized and may not reflect sustained performance.',
    required: false,
  })
  warning?: string;

  @ApiProperty({
    description:
      'Average cash allocation percentage over the period (as decimal)',
    example: 0.17,
    required: false,
  })
  cashAllocationAvg?: number;

  @ApiProperty({
    description: 'Metadata about date range and data completeness',
    required: false,
    example: {
      startDate: '2025-12-11',
      endDate: '2026-01-11',
      dataPoints: 22,
      isPartialData: true,
      requestedDays: 90,
      actualDays: 31,
      portfolioCreationDate: '2025-12-11T00:00:00.000Z',
      warningMessage:
        'Portfolio created Dec 11, 2025. Showing 31 days instead of 3 months.',
      isNewYearReset: false,
      isCashOnly: false,
    },
  })
  metadata?: {
    startDate?: string;
    endDate?: string;
    dataPoints?: number;
    isPartialData?: boolean;
    isEmpty?: boolean;
    requestedDays?: number;
    actualDays?: number;
    portfolioCreationDate?: string;
    warningMessage?: string;
    isNewYearReset?: boolean;
    isCashOnly?: boolean;
  };

  constructor(partial: Partial<BenchmarkComparisonDto>) {
    Object.assign(this, partial);
  }
}
