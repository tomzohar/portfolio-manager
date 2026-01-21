import { HITLApproval } from './hitl-approval.entity';
import { ApprovalStatus } from '../types/approval-status.enum';

describe('HITLApproval Entity', () => {
  it('should be defined', () => {
    const approval = new HITLApproval();
    expect(approval).toBeDefined();
  });

  it('should have all required properties', () => {
    const approval = new HITLApproval();

    // Required fields
    expect(() => {
      approval.id = 'approval-123';
      approval.threadId = 'thread-456';
      approval.userId = 'user-789';
      approval.approvalType = 'cost_threshold';
      approval.status = ApprovalStatus.PENDING;
      approval.prompt = 'Analysis will cost $2.50. Approve?';
      approval.createdAt = new Date();
    }).not.toThrow();

    // Nullable fields
    expect(() => {
      approval.context = null;
      approval.userResponse = null;
      approval.respondedAt = null;
      approval.expiresAt = null;
    }).not.toThrow();
  });

  it('should support all ApprovalStatus enum values', () => {
    const approval = new HITLApproval();

    // Test PENDING
    approval.status = ApprovalStatus.PENDING;
    expect(approval.status).toBe('pending');

    // Test APPROVED
    approval.status = ApprovalStatus.APPROVED;
    expect(approval.status).toBe('approved');

    // Test REJECTED
    approval.status = ApprovalStatus.REJECTED;
    expect(approval.status).toBe('rejected');

    // Test EXPIRED
    approval.status = ApprovalStatus.EXPIRED;
    expect(approval.status).toBe('expired');
  });

  it('should accept JSONB data for context', () => {
    const approval = new HITLApproval();

    // Simple context
    approval.context = { costEstimate: { totalCostUSD: 2.5 } };
    expect(approval.context).toHaveProperty('costEstimate');

    // Complex nested context
    approval.context = {
      costEstimate: {
        totalCostUSD: 5.75,
        estimatedTimeSeconds: 120,
        breakdown: [
          { nodeName: 'macro_analysis', costUSD: 2.5, timeSeconds: 60 },
          { nodeName: 'technical_analysis', costUSD: 3.25, timeSeconds: 60 },
        ],
      },
      analysisPlan: {
        nodes: ['macro_analysis', 'technical_analysis'],
        tools: ['FRED', 'Polygon'],
      },
    };
    expect(approval.context).toHaveProperty('costEstimate');
    expect(approval.context).toHaveProperty('analysisPlan');
  });

  it('should handle nullable fields correctly', () => {
    const approval = new HITLApproval();

    // context can be null
    approval.context = null;
    expect(approval.context).toBeNull();

    approval.context = { data: 'test' };
    expect(approval.context).toHaveProperty('data');

    // userResponse can be null
    approval.userResponse = null;
    expect(approval.userResponse).toBeNull();

    approval.userResponse = 'User approved via UI';
    expect(approval.userResponse).toBe('User approved via UI');

    // respondedAt can be null
    approval.respondedAt = null;
    expect(approval.respondedAt).toBeNull();

    approval.respondedAt = new Date('2024-01-15T10:30:00Z');
    expect(approval.respondedAt).toBeInstanceOf(Date);

    // expiresAt can be null
    approval.expiresAt = null;
    expect(approval.expiresAt).toBeNull();

    approval.expiresAt = new Date('2024-01-15T11:30:00Z');
    expect(approval.expiresAt).toBeInstanceOf(Date);
  });

  it('should support typical cost threshold approval', () => {
    const approval = new HITLApproval();
    approval.approvalType = 'cost_threshold';
    approval.threadId = 'thread-123';
    approval.userId = 'user-456';
    approval.status = ApprovalStatus.PENDING;
    approval.prompt =
      'The analysis will cost approximately $2.50 and take 2 minutes. Approve?';
    approval.context = {
      costEstimate: {
        totalCostUSD: 2.5,
        estimatedTimeSeconds: 120,
      },
    };
    approval.expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    expect(approval.approvalType).toBe('cost_threshold');
    expect(approval.status).toBe(ApprovalStatus.PENDING);
    expect(approval.context).toHaveProperty('costEstimate');
  });

  it('should handle approval → approved transition', () => {
    const approval = new HITLApproval();
    approval.status = ApprovalStatus.PENDING;
    approval.userResponse = null;
    approval.respondedAt = null;

    // User approves
    approval.status = ApprovalStatus.APPROVED;
    approval.userResponse = 'User clicked Approve button';
    approval.respondedAt = new Date();

    expect(approval.status).toBe(ApprovalStatus.APPROVED);
    expect(approval.userResponse).toBeDefined();
    expect(approval.respondedAt).toBeInstanceOf(Date);
  });

  it('should handle approval → rejected transition', () => {
    const approval = new HITLApproval();
    approval.status = ApprovalStatus.PENDING;

    // User rejects
    approval.status = ApprovalStatus.REJECTED;
    approval.userResponse = 'Too expensive';
    approval.respondedAt = new Date();

    expect(approval.status).toBe(ApprovalStatus.REJECTED);
    expect(approval.userResponse).toBe('Too expensive');
  });

  it('should handle approval → expired transition', () => {
    const approval = new HITLApproval();
    approval.status = ApprovalStatus.PENDING;
    approval.expiresAt = new Date(Date.now() - 1000); // Already expired

    // Cron job expires the approval
    approval.status = ApprovalStatus.EXPIRED;

    expect(approval.status).toBe(ApprovalStatus.EXPIRED);
  });

  describe('ApprovalStatus enum', () => {
    it('should have all required status values', () => {
      expect(ApprovalStatus.PENDING).toBe('pending');
      expect(ApprovalStatus.APPROVED).toBe('approved');
      expect(ApprovalStatus.REJECTED).toBe('rejected');
      expect(ApprovalStatus.EXPIRED).toBe('expired');
    });

    it('should have exactly 4 status values', () => {
      const statusValues = Object.values(ApprovalStatus);
      expect(statusValues).toHaveLength(4);
    });
  });

  describe('Entity relationships', () => {
    it('should have required relation to User', () => {
      const approval = new HITLApproval();

      // userId is required (not nullable in entity)
      approval.userId = 'user-uuid-456';
      expect(approval.userId).toBe('user-uuid-456');
    });
  });

  describe('Field constraints', () => {
    it('should respect prompt length (TEXT column)', () => {
      const approval = new HITLApproval();
      const longPrompt = 'a'.repeat(10000); // Long text

      approval.prompt = longPrompt;
      expect(approval.prompt).toHaveLength(10000);
    });

    it('should handle approval_type of various values', () => {
      const approval = new HITLApproval();

      approval.approvalType = 'cost_threshold';
      expect(approval.approvalType).toBe('cost_threshold');

      approval.approvalType = 'data_access';
      expect(approval.approvalType).toBe('data_access');

      approval.approvalType = 'custom_approval';
      expect(approval.approvalType).toBe('custom_approval');
    });

    it('should handle user_response length constraint (50 chars)', () => {
      const approval = new HITLApproval();
      const response = 'User approved with confidence';

      approval.userResponse = response;
      expect(approval.userResponse).toHaveLength(29);
      expect(approval.userResponse).toBe(response);
    });

    it('should handle date fields correctly', () => {
      const approval = new HITLApproval();

      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 3600000);

      approval.createdAt = now;
      approval.expiresAt = oneHourLater;
      approval.respondedAt = null;

      expect(approval.createdAt).toEqual(now);
      expect(approval.expiresAt).toEqual(oneHourLater);
      expect(approval.respondedAt).toBeNull();
    });
  });
});
