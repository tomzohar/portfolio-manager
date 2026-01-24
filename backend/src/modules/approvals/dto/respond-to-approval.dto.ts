import { ApiProperty } from '@nestjs/swagger';

/**
 * RespondToApprovalDto
 *
 * DTO for responding to approval requests.
 * User can approve or reject a pending approval.
 */
export class RespondToApprovalDto {
  @ApiProperty({
    description: 'User response to approval',
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  response: 'approved' | 'rejected';

  @ApiProperty({
    description: 'Optional reason for the response',
    example: 'Looks good, proceed with analysis',
    required: false,
  })
  reason?: string;
}
