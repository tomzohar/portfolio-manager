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

/**
 * ReasoningTrace Entity
 * Stores the agent's thought process for debugging and transparency.
 * Each trace represents one node execution in the LangGraph workflow.
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
    default: 'completed',
    nullable: true,
  })
  status?: string; // 'pending' | 'running' | 'completed' | 'failed' | 'interrupted'

  @Column({ type: 'jsonb', default: () => "'[]'", nullable: true })
  toolResults?: Array<{ tool: string; result: any }>;

  @Column({ type: 'integer', nullable: true })
  durationMs?: number;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'integer', nullable: true })
  stepIndex?: number;

  @CreateDateColumn()
  createdAt: Date;
}
