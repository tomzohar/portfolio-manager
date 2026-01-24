import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApprovalStatus } from '../types/approval-status.enum';

/**
 * HITLApproval Entity
 *
 * Stores Human-in-the-Loop approval requests for cost threshold gates.
 * Enables user consent before executing expensive analysis operations.
 *
 * Features:
 * - Links approvals to threads and users (required for security)
 * - Tracks approval status lifecycle (pending → approved/rejected/expired)
 * - Stores approval context (cost estimates, analysis plans)
 * - Supports expiration for time-limited approvals
 * - Cascade delete when user is deleted
 *
 * Use Cases:
 * - "Analysis will cost $2.50, approve?"
 * - "High-cost operation detected, waiting for approval"
 * - "Approval expired, operation cancelled"
 *
 * This entity supports US-003: HITL Approval System
 * from the Digital CIO Chat Interface feature.
 */
@Entity('hitl_approvals')
export class HITLApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thread_id', type: 'varchar', length: 255 })
  @Index()
  threadId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'approval_type', type: 'varchar', length: 50 })
  approvalType: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ApprovalStatus.PENDING,
  })
  @Index()
  status: ApprovalStatus;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any> | null;

  @Column({
    name: 'user_response',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  userResponse: string | null;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  @Index('IDX_hitl_approvals_expires_pending', { where: "status = 'pending'" })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
