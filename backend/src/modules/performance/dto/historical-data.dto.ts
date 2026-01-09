import { ApiProperty } from '@nestjs/swagger';
import { Timeframe } from '../types/timeframe.types';

/**
 * Single data point in historical performance data
 */
export class HistoricalDataPointDto {
  @ApiProperty({
    description: 'Date of the data point (ISO 8601 format)',
    example: '2024-01-15',
  })
  date: string;

  @ApiProperty({
    description: 'Portfolio value normalized to 100 at start date',
    example: 105.5,
  })
  portfolioValue: number;

  @ApiProperty({
    description: 'Benchmark value normalized to 100 at start date',
    example: 102.3,
  })
  benchmarkValue: number;

  constructor(partial: Partial<HistoricalDataPointDto>) {
    Object.assign(this, partial);
  }
}

/**
 * Response DTO for historical performance data
 */
export class HistoricalDataResponseDto {
  @ApiProperty({
    description: 'Portfolio ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  portfolioId: string;

  @ApiProperty({
    description: 'Timeframe of analysis',
    enum: Timeframe,
    example: Timeframe.THREE_MONTHS,
  })
  timeframe: Timeframe;

  @ApiProperty({
    description: 'Array of historical data points',
    type: [HistoricalDataPointDto],
  })
  data: HistoricalDataPointDto[];

  @ApiProperty({
    description: 'Start date of analysis period',
    example: '2023-10-01T00:00:00.000Z',
  })
  startDate: Date;

  @ApiProperty({
    description: 'End date of analysis period',
    example: '2024-01-01T00:00:00.000Z',
  })
  endDate: Date;

  @ApiProperty({
    description:
      'Warning message if cash deposits detected during period. Indicates the chart shows investment performance adjusted for cash flows.',
    example:
      'Portfolio returns are adjusted for cash deposits during this period. The chart shows investment performance, not total value growth.',
    required: false,
  })
  warning?: string;

  @ApiProperty({
    description: 'View mode: TOTAL (includes cash) or INVESTED (excludes cash)',
    enum: ['TOTAL', 'INVESTED'],
    example: 'TOTAL',
  })
  viewMode: 'TOTAL' | 'INVESTED';

  @ApiProperty({
    description:
      'Average cash allocation percentage over the period (as decimal)',
    example: 0.25,
    required: false,
  })
  cashAllocationAvg?: number;

  constructor(partial: Partial<HistoricalDataResponseDto>) {
    Object.assign(this, partial);
  }
}
