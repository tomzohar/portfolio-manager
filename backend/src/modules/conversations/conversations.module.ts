import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationMessage } from './entities/conversation-message.entity';
import { ConversationService } from './services/conversation.service';

/**
 * Conversations Module
 *
 * Manages conversation message persistence for the chat interface.
 * Implements CQRS read model for conversation display, separate from
 * reasoning traces (which are used for debugging/observability).
 *
 * Features:
 * - Save user messages immediately when conversation starts
 * - Save AI responses when graph completes
 * - Retrieve messages in chronological order
 * - Support pagination for long conversations
 * - Link AI messages to reasoning traces
 *
 * This module supports Chat Message Persistence (Solution A)
 * as specified in Chat_Message_Persistence.md.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ConversationMessage])],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationsModule {}
