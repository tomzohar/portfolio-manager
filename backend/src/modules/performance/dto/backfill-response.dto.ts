import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for portfolio snapshot backfill
 *
 * Returns metadata about the completed backfill operation
 */
export class BackfillResponseDto {
  @ApiProperty({
    example: 'Portfolio snapshots backfilled successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    example: 365,
    description: 'Number of days processed during backfill',
  })
  daysCalculated: number;

  @ApiProperty({
    example: '2024-01-01',
    description: 'Start date used for backfill (YYYY-MM-DD format)',
  })
  startDate: string;

  @ApiProperty({
    example: '2024-12-31',
    description: 'End date used for backfill (YYYY-MM-DD format)',
  })
  endDate: string;

  constructor(partial: Partial<BackfillResponseDto>) {
    Object.assign(this, partial);
  }
}
