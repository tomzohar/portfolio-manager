/**
 * ConversationMessageMetadata Interface
 *
 * Stores additional metadata for conversation messages.
 * Structured as JSONB in the database for flexibility.
 */
export interface ConversationMessageMetadata {
  /** IDs of reasoning traces linked to this message (for assistant messages) */
  traceIds?: string[];

  /** Whether this message was optimistically rendered (reserved for future use) */
  isOptimistic?: boolean;

  /** Timestamp when message was edited (for future message editing feature) */
  editedAt?: Date;

  /** User reactions to the message (for future reactions feature) */
  reactions?: string[];

  /** Number of tool calls made for this response */
  toolCallCount?: number;

  /** Which LLM model generated this response (for analytics) */
  modelUsed?: string;

  /** Error message if the message represents a failed operation */
  errorMessage?: string;
}
