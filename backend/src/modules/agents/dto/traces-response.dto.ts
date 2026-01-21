import { ApiProperty } from '@nestjs/swagger';

/**
 * Individual trace in the response
 */
export class TraceDto {
  @ApiProperty({
    description: 'Unique trace identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Thread ID for the graph execution',
    example: '123e4567-e89b-12d3-a456-426614174000:abc123',
  })
  threadId: string;

  @ApiProperty({
    description: 'User ID who owns this trace',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Name of the graph node that was executed',
    example: 'observer',
  })
  nodeName: string;

  @ApiProperty({
    description: 'Input data passed to the node (JSONB)',
    example: { message: 'Analyze my portfolio' },
  })
  input: Record<string, any>;

  @ApiProperty({
    description: 'Output data returned by the node (JSONB)',
    example: { observation: 'Portfolio data retrieved' },
  })
  output: Record<string, any>;

  @ApiProperty({
    description: "Human-readable explanation of the node's decision",
    example: 'Fetching user portfolio context',
  })
  reasoning: string;

  @ApiProperty({
    description: 'Timestamp when the trace was created',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;
}

/**
 * Response DTO for GET /agents/traces/:threadId
 *
 * Returns historical reasoning traces for a specific graph execution thread.
 * Traces are returned in chronological order (oldest first) to match execution flow.
 */
export class TracesResponseDto {
  @ApiProperty({
    description: 'Thread ID that was queried',
    example: '123e4567-e89b-12d3-a456-426614174000:abc123',
  })
  threadId: string;

  @ApiProperty({
    description:
      'Array of reasoning traces in chronological order (oldest first)',
    type: [TraceDto],
    isArray: true,
  })
  traces: TraceDto[];
}
