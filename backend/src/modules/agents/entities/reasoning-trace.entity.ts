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
import { TraceStatus } from '../types/trace-status.enum';
import { ToolResult } from '../types/tool-result.interface';

/**
 * ReasoningTrace Entity
 * Stores the agent's thought process for debugging and transparency.
 * Each trace represents one node execution in the LangGraph workflow.
 *
 * Enhanced: Step-by-Step Reasoning Transparency
 * - Execution status tracking (pending, running, completed, failed, interrupted)
 * - Tool results with data source information
 * - Duration metrics for performance monitoring
 * - Error messages for failure debugging
 * - Step ordering for sequential trace display
 */
@Entity('reasoning_traces')
@Index(['threadId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['threadId', 'stepIndex'])
export class ReasoningTrace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  threadId: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  nodeName: string;

  @Column('jsonb')
  input: Record<string, any>;

  @Column('jsonb')
  output: Record<string, any>;

  @Column('text')
  reasoning: string;

  // Enhanced fields for US-001: Step-by-Step Reasoning Transparency
  @Column({
    type: 'varchar',
    length: 20,
    default: TraceStatus.COMPLETED,
    nullable: true,
  })
  status?: TraceStatus;

  @Column({ type: 'jsonb', default: () => "'[]'", nullable: true })
  toolResults?: ToolResult[];

  @Column({ type: 'integer', nullable: true })
  durationMs?: number;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'integer', nullable: true })
  stepIndex?: number;

  @CreateDateColumn()
  createdAt: Date;
}
