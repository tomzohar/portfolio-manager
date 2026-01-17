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
 * TokenUsage Entity
 * Tracks LLM token consumption per user for cost monitoring and usage analytics.
 */
@Entity('token_usage')
@Index(['userId', 'createdAt'])
export class TokenUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  modelName: string;

  @Column('int')
  promptTokens: number;

  @Column('int')
  completionTokens: number;

  @Column('int')
  totalTokens: number;

  @Column('decimal', { precision: 10, scale: 6 })
  estimatedCost: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
