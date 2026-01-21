/**
 * RespondToApprovalDto
 *
 * DTO for responding to approval requests.
 * Will be enhanced in US-003-BE-T6.
 */
export class RespondToApprovalDto {
  response: 'approved' | 'rejected';
  reason?: string;
}
