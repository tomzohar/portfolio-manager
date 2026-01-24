import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../types/approval-status.enum';
import { CostEstimate } from '../types/cost-estimate.interface';

/**
 * Approval context can contain cost estimates or other metadata
 * This is a flexible type that allows partial data structures
 */
export interface ApprovalContext {
  costEstimate?: Partial<CostEstimate>;
  [key: string]: unknown;
}

/**
 * ApprovalResponseDto
 *
 * DTO for approval retrieval endpoints.
 * Returns essential approval information.
 */
export class ApprovalResponseDto {
  @ApiProperty({
    description: 'Approval unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Type of approval',
    example: 'cost_threshold',
  })
  approvalType: string;

  @ApiProperty({
    description: 'Approval status',
    enum: ApprovalStatus,
    example: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @ApiProperty({
    description: 'Prompt shown to user',
    example:
      'The analysis will cost approximately $2.50 and take 2 minutes. Approve?',
  })
  prompt: string;

  @ApiProperty({
    description: 'Additional context (cost estimates, analysis plan)',
    example: { costEstimate: { totalCostUSD: 2.5, estimatedTimeSeconds: 120 } },
    nullable: true,
  })
  context: ApprovalContext | null;

  @ApiProperty({
    description: 'Expiration timestamp',
    example: '2024-01-15T11:30:00Z',
    nullable: true,
  })
  expiresAt: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}
