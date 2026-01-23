import { ConversationMessageType } from '../types/conversation-message-type.enum';
import { ConversationMessageMetadata } from '../types/conversation-message-metadata.interface';

/**
 * DTO for conversation message response.
 * Represents a single message in a conversation thread.
 */
export class ConversationMessageDto {
  /** Unique identifier for the message */
  id: string;

  /** Thread ID this message belongs to */
  threadId: string;

  /** User ID who owns this message/thread */
  userId: string;

  /** Type of message (user, assistant, system) */
  type: ConversationMessageType;

  /** Message content */
  content: string;

  /** Sequence number for ordering within thread */
  sequence: number;

  /** Additional metadata (trace IDs, model used, etc.) */
  metadata?: ConversationMessageMetadata;

  /** Timestamp when message was created */
  createdAt: Date;
}
