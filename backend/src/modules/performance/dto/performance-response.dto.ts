import { ApiProperty } from '@nestjs/swagger';
import { Timeframe } from '../types/timeframe.types';

/**
 * Cash flow entry for IRR calculation
 */
export class CashFlowDto {
  @ApiProperty({ description: 'Date of cash flow' })
  date: Date;

  @ApiProperty({
    description:
      'Amount of cash flow (negative for outflows, positive for inflows)',
  })
  amount: number;

  constructor(partial: Partial<CashFlowDto>) {
    Object.assign(this, partial);
  }
}

/**
 * Response DTO for performance calculation results
 */
export class PerformanceResponseDto {
  @ApiProperty({ description: 'Portfolio ID' })
  portfolioId: string;

  @ApiProperty({ description: 'Timeframe of analysis', enum: Timeframe })
  timeframe: Timeframe;

  @ApiProperty({ description: 'Start date of analysis period' })
  startDate: Date;

  @ApiProperty({ description: 'End date of analysis period' })
  endDate: Date;

  @ApiProperty({
    description: 'Return percentage (as decimal, e.g., 0.15 = 15%)',
  })
  returnPercentage: number;

  @ApiProperty({
    description: 'Cash flows used in calculation',
    type: [CashFlowDto],
  })
  cashFlows: CashFlowDto[];

  constructor(partial: Partial<PerformanceResponseDto>) {
    Object.assign(this, partial);
  }
}
