import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationMessage } from '../entities/conversation-message.entity';
import {
  Conversation,
  ConversationConfig,
} from '../entities/conversation.entity';
import { ConversationMessageType } from '../types/conversation-message-type.enum';
import { ConversationMessageMetadata } from '../types/conversation-message-metadata.interface';

/** Parameters for saving a user message */
export interface SaveUserMessageParams {
  threadId: string;
  userId: string;
  content: string;
}

/** Parameters for saving an assistant message */
export interface SaveAssistantMessageParams {
  threadId: string;
  userId: string;
  content: string;
  traceIds: string[];
  modelUsed?: string;
}

/** Parameters for paginated message retrieval */
export interface GetPaginatedMessagesParams {
  threadId: string;
  userId?: string;
  limit?: number;
  beforeSequence?: number;
  afterSequence?: number;
}

/** Result of paginated message retrieval */
export interface PaginatedMessagesResult {
  messages: ConversationMessage[];
  hasMore: boolean;
}

/** Parameters for searching messages */
export interface SearchMessagesParams {
  threadId: string;
  userId: string;
  query: string;
  limit?: number;
}

/**
 * ConversationService
 *
 * Manages conversation messages for reliable persistence and retrieval.
 * This service implements the CQRS read model for conversation display,
 * separate from reasoning traces which are used for debugging/observability.
 *
 * Key responsibilities:
 * - Save user messages immediately when conversation starts (before graph execution)
 * - Save AI responses when graph completes (with links to reasoning traces)
 * - Retrieve messages in chronological order for conversation display
 * - Support pagination for long conversations
 *
 * This service is part of Chat Message Persistence (Solution A)
 * as specified in Chat_Message_Persistence.md.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(ConversationMessage)
    private readonly messageRepo: Repository<ConversationMessage>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
  ) {}

  /**
   * Save user message when conversation starts.
   * Called immediately when user sends message, BEFORE graph execution.
   * This ensures the message is persisted even if the graph fails.
   *
   * @param params - User message parameters
   * @returns The saved conversation message
   */
  async saveUserMessage(
    params: SaveUserMessageParams,
  ): Promise<ConversationMessage> {
    const sequence = await this.getNextSequence(params.threadId);

    // Ensure conversation entity exists so we can store config/metadata
    await this.ensureConversationExists(params.threadId, params.userId);

    const message = this.messageRepo.create({
      threadId: params.threadId,
      userId: params.userId,
      type: ConversationMessageType.USER,
      content: params.content,
      sequence,
      metadata: {},
    });

    const saved = await this.messageRepo.save(message);
    this.logger.debug(
      `User message saved: ${saved.id} (thread: ${params.threadId}, seq: ${sequence})`,
    );

    return saved;
  }

  /**
   * Save AI response when graph completes.
   * Called by graph completion handler with final report.
   *
   * @param params - Assistant message parameters including trace IDs for linking
   * @returns The saved conversation message
   */
  async saveAssistantMessage(
    params: SaveAssistantMessageParams,
  ): Promise<ConversationMessage> {
    const sequence = await this.getNextSequence(params.threadId);

    const metadata: ConversationMessageMetadata = {
      traceIds: params.traceIds,
      modelUsed: params.modelUsed,
    };

    const message = this.messageRepo.create({
      threadId: params.threadId,
      userId: params.userId,
      type: ConversationMessageType.ASSISTANT,
      content: params.content,
      sequence,
      metadata,
    });

    const saved = await this.messageRepo.save(message);
    this.logger.debug(
      `Assistant message saved: ${saved.id} (thread: ${params.threadId}, seq: ${sequence})`,
    );

    return saved;
  }

  /**
   * Update an existing assistant message with final content.
   * Called after graph completion to populate the message created before execution.
   *
   * @param messageId - ID of the message to update
   * @param content - Final content to set
   * @param traceIds - Optional trace IDs to link
   * @returns The updated message
   */
  async updateAssistantMessage(
    messageId: string,
    content: string,
    traceIds?: string[],
  ): Promise<ConversationMessage> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Update content
    message.content = content;

    // Update metadata if traceIds provided
    if (traceIds) {
      message.metadata = {
        ...message.metadata,
        traceIds,
      };
    }

    const updated = await this.messageRepo.save(message);
    this.logger.debug(
      `Assistant message updated: ${updated.id} (content length: ${content.length})`,
    );

    return updated;
  }

  /**
   * Get all messages for a thread (for conversation display).
   * Messages are returned in chronological order by sequence number.
   *
   * @param threadId - The thread ID to get messages for
   * @param userId - Optional user ID for authorization check
   * @returns Array of conversation messages in order
   */
  async getThreadMessages(
    threadId: string,
    userId?: string,
  ): Promise<ConversationMessage[]> {
    const where: { threadId: string; userId?: string } = { threadId };
    if (userId) {
      where.userId = userId;
    }

    return this.messageRepo.find({
      where,
      order: { sequence: 'ASC' },
    });
  }

  /**
   * Get messages for a thread with optional pagination.
   * Automatically decides whether to use pagination based on query parameters.
   * This encapsulates the business logic for message retrieval.
   *
   * @param params - Parameters including threadId, userId, and optional pagination
   * @returns Array of conversation messages
   */
  async getMessages(params: {
    threadId: string;
    userId: string;
    limit?: number;
    beforeSequence?: number;
    afterSequence?: number;
  }): Promise<ConversationMessage[]> {
    // Determine if cursor-based pagination is explicitly requested
    // Cursor-based pagination is used when:
    // - beforeSequence: loading older messages (backward pagination)
    // - afterSequence: loading newer messages (forward pagination)
    const hasPaginationCursors =
      params.beforeSequence !== undefined || params.afterSequence !== undefined;

    if (hasPaginationCursors) {
      const result = await this.getPaginatedMessages({
        threadId: params.threadId,
        userId: params.userId,
        limit: params.limit || 50, // Use provided limit or default to 50 for pagination
        beforeSequence: params.beforeSequence,
        afterSequence: params.afterSequence,
      });
      return result.messages;
    }

    // If limit is provided without cursors, apply simple limit
    if (params.limit !== undefined) {
      return this.messageRepo.find({
        where: {
          threadId: params.threadId,
          userId: params.userId,
        },
        order: { sequence: 'ASC' },
        take: params.limit,
      });
    }

    // Default: return all messages for the thread (no limit, no pagination)
    return this.getThreadMessages(params.threadId, params.userId);
  }

  /**
   * Get paginated messages (for infinite scroll / large conversations).
   * Returns messages in descending order from DB, then reverses to ascending for display.
   *
   * @param params - Pagination parameters
   * @returns Messages and hasMore flag
   */
  async getPaginatedMessages(
    params: GetPaginatedMessagesParams,
  ): Promise<PaginatedMessagesResult> {
    const limit = params.limit || 50;

    const query = this.messageRepo
      .createQueryBuilder('msg')
      .where('msg.threadId = :threadId', { threadId: params.threadId });

    if (params.userId) {
      query.andWhere('msg.userId = :userId', { userId: params.userId });
    }

    if (params.beforeSequence !== undefined) {
      query.andWhere('msg.sequence < :beforeSequence', {
        beforeSequence: params.beforeSequence,
      });
    }

    if (params.afterSequence !== undefined) {
      query.andWhere('msg.sequence > :afterSequence', {
        afterSequence: params.afterSequence,
      });
    }

    // Fetch one extra to check if there are more messages
    query.orderBy('msg.sequence', 'DESC').limit(limit + 1);

    const messages = await query.getMany();
    const hasMore = messages.length > limit;

    return {
      // Reverse to get ascending order (oldest first) for display
      messages: messages.slice(0, limit).reverse(),
      hasMore,
    };
  }

  /**
   * Get message count for a thread.
   *
   * @param threadId - The thread ID to count messages for
   * @returns Number of messages in the thread
   */
  async getMessageCount(threadId: string): Promise<number> {
    return this.messageRepo.count({ where: { threadId } });
  }

  /**
   * Delete all messages for a thread (when thread is deleted).
   *
   * @param threadId - The thread ID to delete messages for
   */
  async deleteThreadMessages(threadId: string): Promise<void> {
    await this.messageRepo.delete({ threadId });
    this.logger.debug(`Deleted all messages for thread: ${threadId}`);
  }

  /**
   * Search messages in a thread for specific content.
   *
   * @param params - Search parameters (threadId, query, etc.)
   * @returns Array of matching messages
   */
  async searchMessages(
    params: SearchMessagesParams,
  ): Promise<ConversationMessage[]> {
    const limit = params.limit || 5;

    return (
      this.messageRepo
        .createQueryBuilder('msg')
        .where('msg.threadId = :threadId', { threadId: params.threadId })
        .andWhere('msg.userId = :userId', { userId: params.userId })
        // Use Full Text Search with plainto_tsquery for natural language search
        .andWhere('msg.search_vector @@ plainto_tsquery(:query)', {
          query: params.query,
        })
        // Rank by relevance (ts_rank), then recency
        .orderBy('ts_rank(msg.search_vector, plainto_tsquery(:query))', 'DESC')
        .addOrderBy('msg.created_at', 'DESC')
        .take(limit)
        .getMany()
    );
  }

  /**
   * Ensure a conversation exists for the thread.
   */
  async ensureConversationExists(
    threadId: string,
    userId: string,
  ): Promise<Conversation> {
    let conversation = await this.conversationRepo.findOne({
      where: { id: threadId },
    });

    if (!conversation) {
      conversation = this.conversationRepo.create({
        id: threadId,
        userId,
        config: {},
      });
      await this.conversationRepo.save(conversation);
    }

    return conversation;
  }

  /**
   * Get conversation details including configuration.
   */
  async getConversation(
    threadId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: threadId, userId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${threadId} not found`);
    }

    return conversation;
  }

  /**
   * Update conversation configuration.
   */
  async updateConfiguration(
    threadId: string,
    userId: string,
    config: ConversationConfig,
  ): Promise<boolean> {
    await this.conversationRepo.update({ id: threadId, userId }, { config });
    return true;
  }

  /**
   * Get the next sequence number for a thread.
   * Private method that finds the last message and increments its sequence.
   *
   * @param threadId - The thread ID to get next sequence for
   * @returns Next sequence number (0 if no messages exist)
   */
  private async getNextSequence(threadId: string): Promise<number> {
    const lastMessage = await this.messageRepo.findOne({
      where: { threadId },
      order: { sequence: 'DESC' },
    });

    return lastMessage ? lastMessage.sequence + 1 : 0;
  }
}
