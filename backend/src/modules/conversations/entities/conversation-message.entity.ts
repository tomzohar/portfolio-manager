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
import { ConversationMessageType } from '../types/conversation-message-type.enum';
import { ConversationMessageMetadata } from '../types/conversation-message-metadata.interface';

/**
 * ConversationMessage Entity
 *
 * Stores user and assistant messages for conversation display.
 * This entity is separate from reasoning traces, following CQRS pattern:
 * - ConversationMessage: Read model for conversation display (user-facing)
 * - ReasoningTrace: Technical debugging and observability (developer-facing)
 *
 * Features:
 * - Stores user and assistant messages with guaranteed ordering via sequence
 * - Links to threads and users (required for security and filtering)
 * - Supports JSONB metadata for extensibility (trace links, reactions, editing)
 * - Cascade delete when parent user is deleted
 * - Composite unique constraint on (threadId, sequence) for ordering integrity
 *
 * Use Cases:
 * - "Load conversation history on page reload"
 * - "Display chronological chat messages to user"
 * - "Link AI responses to their reasoning traces"
 *
 * This entity supports reliable message persistence as specified in
 * Chat_Message_Persistence.md (Solution A: Separate Conversation Messages Entity).
 */
@Entity('conversation_messages')
@Index('IDX_conversation_messages_thread_sequence', ['threadId', 'sequence'], {
  unique: true,
})
@Index('IDX_conversation_messages_thread_created', ['threadId', 'createdAt'])
@Index('IDX_conversation_messages_user', ['userId'])
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thread_id', type: 'varchar', length: 255 })
  @Index()
  threadId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: ConversationMessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'integer' })
  sequence: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: ConversationMessageMetadata | null;

  // Generated tsvector for Full Text Search
  @Column({
    type: 'tsvector',
    select: false,
    insert: false,
    update: false,
    nullable: true,
  })
  search_vector: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
