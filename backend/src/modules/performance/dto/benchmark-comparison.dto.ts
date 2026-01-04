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

  constructor(partial: Partial<BenchmarkComparisonDto>) {
    Object.assign(this, partial);
  }
}
