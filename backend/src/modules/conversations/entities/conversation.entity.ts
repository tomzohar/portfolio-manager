import {
  Entity,
  Column,
  Index,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface ConversationConfig {
  showTraces?: boolean;
  [key: string]: any;
}

@Entity('conversations')
@Index('IDX_conversations_user', ['userId'])
export class Conversation {
  // We use the threadId as the primary key
  @PrimaryColumn('varchar', { length: 255 })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'jsonb', default: {} })
  config: ConversationConfig;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
