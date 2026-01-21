/**
 * ApprovalStatus Enum
 *
 * Defines the lifecycle states of a HITL (Human-in-the-Loop) approval.
 * Used to track approval requests from creation through resolution.
 *
 * States:
 * - PENDING: Approval requested, awaiting user response
 * - APPROVED: User approved the request, graph execution continues
 * - REJECTED: User rejected the request, graph execution cancelled
 * - EXPIRED: Approval expired without response, graph execution cancelled
 */
export enum ApprovalStatus {
  /** Approval requested, awaiting user response */
  PENDING = 'pending',

  /** User approved the request */
  APPROVED = 'approved',

  /** User rejected the request */
  REJECTED = 'rejected',

  /** Approval expired without response */
  EXPIRED = 'expired',
}

/**
 * Type guard to validate if a string is a valid ApprovalStatus
 * @param value - String to validate
 * @returns true if value is a valid ApprovalStatus, false otherwise
 */
export function isValidApprovalStatus(value: string): value is ApprovalStatus {
  return Object.values(ApprovalStatus).includes(value as ApprovalStatus);
}
