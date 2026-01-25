import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConversationMessage } from './entities/conversation-message.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationService } from './services/conversation.service';
import { ConversationsController } from './conversations.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

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
  imports: [
    TypeOrmModule.forFeature([ConversationMessage, Conversation]),
    JwtModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ConversationsController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationsModule {}
