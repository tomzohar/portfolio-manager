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

  constructor(partial: Partial<HistoricalDataResponseDto>) {
    Object.assign(this, partial);
  }
}
