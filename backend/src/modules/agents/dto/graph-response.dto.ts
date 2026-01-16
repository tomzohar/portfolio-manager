import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for graph execution
 */
export class GraphResponseDto {
  @ApiProperty({
    description: 'Thread ID for this graph execution (scoped with userId)',
    example: '123e4567-e89b-12d3-a456-426614174000:abc123',
  })
  threadId: string;

  @ApiProperty({
    description: 'Final state after graph execution',
  })
  finalState: Record<string, any>;

  @ApiProperty({
    description: 'Whether the graph executed successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Execution status of the graph',
    enum: ['SUSPENDED', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
  })
  status: 'SUSPENDED' | 'COMPLETED' | 'FAILED';

  @ApiProperty({
    description: 'Reason for interrupt if status is SUSPENDED',
    required: false,
  })
  interruptReason?: string;

  @ApiProperty({
    description: 'Error message if execution failed',
    required: false,
  })
  error?: string;
}
