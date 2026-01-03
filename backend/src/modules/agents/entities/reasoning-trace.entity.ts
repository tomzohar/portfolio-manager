import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
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
  user: User;

  @Column()
  nodeName: string;

  @Column('jsonb')
  input: Record<string, any>;

  @Column('jsonb')
  output: Record<string, any>;

  @Column('text')
  reasoning: string;

  @CreateDateColumn()
  createdAt: Date;
}
