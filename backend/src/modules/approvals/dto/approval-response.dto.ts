import { ApprovalStatus } from '../types/approval-status.enum';

/**
 * ApprovalResponseDto
 *
 * DTO for approval retrieval endpoints.
 * Returns essential approval information.
 */
export class ApprovalResponseDto {
  id: string;
  approvalType: string;
  status: ApprovalStatus;
  prompt: string;
  context: any;
  expiresAt: Date | null;
  createdAt: Date;
}
