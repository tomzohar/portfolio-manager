import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { ConversationMessage } from '../entities/conversation-message.entity';
import { ConversationMessageType } from '../types/conversation-message-type.enum';
import { ConversationService } from './conversation.service';
import { User } from 'src/modules/users/entities/user.entity';
import { LLMModels } from '../../agents/types/lll-models.enum';

describe('ConversationService', () => {
  let service: ConversationService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: getRepositoryToken(ConversationMessage),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveUserMessage', () => {
    const baseParams = {
      threadId: 'user-123:thread-456',
      userId: 'user-123',
      content: 'Analyze AAPL stock',
    };

    it('should save user message with sequence 0 for new thread', async () => {
      // Arrange - no previous messages in thread
      mockRepository.findOne.mockResolvedValue(null);

      const mockMessage = {
        id: 'msg-uuid-1',
        ...baseParams,
        type: ConversationMessageType.USER,
        sequence: 0,
        metadata: {},
        createdAt: new Date(),
      } as ConversationMessage;

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      const result = await service.saveUserMessage(baseParams);

      // Assert
      expect(result.sequence).toBe(0);
      expect(result.type).toBe(ConversationMessageType.USER);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { threadId: baseParams.threadId },
        order: { sequence: 'DESC' },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        threadId: baseParams.threadId,
        userId: baseParams.userId,
        type: ConversationMessageType.USER,
        content: baseParams.content,
        sequence: 0,
        metadata: {},
      });
    });

    it('should increment sequence for subsequent messages', async () => {
      // Arrange - thread already has messages
      const lastMessage = {
        id: 'msg-prev',
        sequence: 2,
      } as ConversationMessage;
      mockRepository.findOne.mockResolvedValue(lastMessage);

      const mockMessage = {
        id: 'msg-uuid-2',
        ...baseParams,
        type: ConversationMessageType.USER,
        sequence: 3,
        metadata: {},
        createdAt: new Date(),
      } as ConversationMessage;

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      const result = await service.saveUserMessage(baseParams);

      // Assert
      expect(result.sequence).toBe(3);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sequence: 3 }),
      );
    });

    it('should save user message with correct type and content', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      const mockMessage = {
        id: 'msg-uuid-1',
        ...baseParams,
        type: ConversationMessageType.USER,
        sequence: 0,
        metadata: {},
        createdAt: new Date(),
      } as ConversationMessage;

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      const result = await service.saveUserMessage(baseParams);

      // Assert
      expect(result.type).toBe(ConversationMessageType.USER);
      expect(result.content).toBe(baseParams.content);
      expect(result.threadId).toBe(baseParams.threadId);
      expect(result.userId).toBe(baseParams.userId);
    });

    it('should call repository save', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);
      const mockMessage = {
        id: 'msg-uuid-1',
        ...baseParams,
        type: ConversationMessageType.USER,
        sequence: 0,
        metadata: {},
        createdAt: new Date(),
      } as ConversationMessage;

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      await service.saveUserMessage(baseParams);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('saveAssistantMessage', () => {
    const baseParams = {
      threadId: 'user-123:thread-456',
      userId: 'user-123',
      content: 'Here is the analysis of AAPL...',
      traceIds: ['trace-1', 'trace-2', 'trace-3'],
    };

    it('should save assistant message with trace IDs in metadata', async () => {
      // Arrange
      const lastMessage = { sequence: 0 } as ConversationMessage;
      mockRepository.findOne.mockResolvedValue(lastMessage);

      const mockMessage: ConversationMessage = {
        id: 'msg-uuid-ai',
        ...baseParams,
        type: ConversationMessageType.ASSISTANT,
        sequence: 1,
        metadata: {
          traceIds: baseParams.traceIds,
        },
        createdAt: new Date(),
        user: {
          id: baseParams.userId,
          email: 'test@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
      };

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      const result = await service.saveAssistantMessage(baseParams);

      // Assert
      expect(result.type).toBe(ConversationMessageType.ASSISTANT);
      expect(result.metadata?.traceIds).toEqual(baseParams.traceIds);
    });

    it('should save assistant message with modelUsed in metadata', async () => {
      // Arrange
      const paramsWithModel = {
        ...baseParams,
        modelUsed: LLMModels.GEMINI_2_5_PRO,
      };

      mockRepository.findOne.mockResolvedValue(null);

      const mockMessage: ConversationMessage = {
        id: 'msg-uuid-ai',
        ...paramsWithModel,
        type: ConversationMessageType.ASSISTANT,
        sequence: 0,
        metadata: {
          traceIds: paramsWithModel.traceIds,
          modelUsed: paramsWithModel.modelUsed,
        },
        createdAt: new Date(),
        user: {
          id: baseParams.userId,
          email: 'test@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
      };

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      const result = await service.saveAssistantMessage(paramsWithModel);

      // Assert
      expect(result.metadata?.modelUsed).toBe(LLMModels.GEMINI_2_5_PRO);
    });

    it('should increment sequence correctly after user message', async () => {
      // Arrange - user message exists at sequence 0
      const lastMessage = { sequence: 0 } as ConversationMessage;
      mockRepository.findOne.mockResolvedValue(lastMessage);

      const mockMessage: ConversationMessage = {
        id: 'msg-uuid-ai',
        ...baseParams,
        type: ConversationMessageType.ASSISTANT,
        sequence: 1,
        metadata: { traceIds: baseParams.traceIds },
        createdAt: new Date(),
        user: {
          id: baseParams.userId,
          email: 'test@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
      };

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      const result = await service.saveAssistantMessage(baseParams);

      // Assert
      expect(result.sequence).toBe(1);
    });

    it('should handle empty traceIds array', async () => {
      // Arrange
      const paramsNoTraces = {
        ...baseParams,
        traceIds: [],
      };

      mockRepository.findOne.mockResolvedValue(null);

      const mockMessage: ConversationMessage = {
        id: 'msg-uuid-ai',
        ...paramsNoTraces,
        type: ConversationMessageType.ASSISTANT,
        sequence: 0,
        metadata: { traceIds: [] },
        createdAt: new Date(),
        user: {
          id: baseParams.userId,
          email: 'test@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
      };

      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      // Act
      const result = await service.saveAssistantMessage(paramsNoTraces);

      // Assert
      expect(result.metadata?.traceIds).toEqual([]);
    });
  });

  describe('getThreadMessages', () => {
    const threadId = 'user-123:thread-456';
    const userId = 'user-123';

    it('should retrieve messages in chronological order (by sequence)', async () => {
      // Arrange
      const mockMessages = [
        {
          id: 'msg-1',
          threadId,
          userId,
          type: ConversationMessageType.USER,
          content: 'Hello',
          sequence: 0,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'msg-2',
          threadId,
          userId,
          type: ConversationMessageType.ASSISTANT,
          content: 'Hi there!',
          sequence: 1,
          createdAt: new Date('2024-01-15T10:00:30Z'),
        },
      ] as ConversationMessage[];

      mockRepository.find.mockResolvedValue(mockMessages);

      // Act
      const result = await service.getThreadMessages(threadId, userId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { sequence: 'ASC' },
      });
      expect(result).toEqual(mockMessages);
      expect(result[0].sequence).toBe(0);
      expect(result[1].sequence).toBe(1);
    });

    it('should filter by userId for authorization', async () => {
      // Arrange
      mockRepository.find.mockResolvedValue([]);

      // Act
      await service.getThreadMessages(threadId, userId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { sequence: 'ASC' },
      });
    });

    it('should return empty array for non-existent thread', async () => {
      // Arrange
      mockRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getThreadMessages('non-existent', userId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should work without userId for public threads', async () => {
      // Arrange
      mockRepository.find.mockResolvedValue([]);

      // Act
      await service.getThreadMessages(threadId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId },
        order: { sequence: 'ASC' },
      });
    });
  });

  describe('getPaginatedMessages', () => {
    const threadId = 'user-123:thread-456';
    const userId = 'user-123';

    it('should return paginated messages with hasMore flag', async () => {
      // Arrange
      const mockMessages = Array.from({ length: 51 }, (_, i) => ({
        id: `msg-${i}`,
        threadId,
        sequence: 50 - i, // Descending order
      })) as ConversationMessage[];

      mockQueryBuilder.getMany.mockResolvedValue(mockMessages);

      // Act
      const result = await service.getPaginatedMessages({
        threadId,
        userId,
        limit: 50,
      });

      // Assert
      expect(result.hasMore).toBe(true);
      expect(result.messages.length).toBe(50);
    });

    it('should apply beforeSequence filter for pagination', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getPaginatedMessages({
        threadId,
        userId,
        beforeSequence: 100,
      });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'msg.sequence < :beforeSequence',
        { beforeSequence: 100 },
      );
    });

    it('should apply afterSequence filter for pagination', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getPaginatedMessages({
        threadId,
        userId,
        afterSequence: 50,
      });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'msg.sequence > :afterSequence',
        { afterSequence: 50 },
      );
    });

    it('should default to limit of 50', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getPaginatedMessages({ threadId, userId });

      // Assert
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(51); // limit + 1 for hasMore check
    });

    it('should return messages in ascending order (oldest first)', async () => {
      // Arrange
      const mockMessages = [
        { id: 'msg-3', sequence: 3 },
        { id: 'msg-2', sequence: 2 },
        { id: 'msg-1', sequence: 1 },
      ] as ConversationMessage[];

      mockQueryBuilder.getMany.mockResolvedValue(mockMessages);

      // Act
      const result = await service.getPaginatedMessages({
        threadId,
        userId,
        limit: 10,
      });

      // Assert - should be reversed to ascending order
      expect(result.messages[0].sequence).toBeLessThan(
        result.messages[result.messages.length - 1].sequence,
      );
    });
  });

  describe('getMessages', () => {
    const threadId = 'user-123:thread-456';
    const userId = 'user-123';

    it('should NOT use pagination when only limit is provided (no cursors)', async () => {
      // Arrange
      const mockMessages = [
        { id: 'msg-1', sequence: 0 },
        { id: 'msg-2', sequence: 1 },
      ] as ConversationMessage[];

      mockRepository.find.mockResolvedValue(mockMessages);

      // Act
      const result = await service.getMessages({
        threadId,
        userId,
        limit: 10, // Limit alone should NOT trigger pagination
      });

      // Assert - should use getThreadMessages (no pagination)
      expect(mockRepository.find).toHaveBeenCalled();
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(result).toEqual(mockMessages);
    });

    it('should use pagination when beforeSequence is provided with limit', async () => {
      // Arrange
      const mockMessagesDesc = [
        { id: 'msg-2', sequence: 2 },
        { id: 'msg-1', sequence: 1 },
      ] as ConversationMessage[];

      mockQueryBuilder.getMany.mockResolvedValue(mockMessagesDesc);

      // Act
      const result = await service.getMessages({
        threadId,
        userId,
        limit: 10,
        beforeSequence: 100, // Cursor triggers pagination
      });

      // Assert - should call getPaginatedMessages
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
      // Result should be reversed to ascending order (oldest first)
      expect(result.length).toBe(2);
      expect(result[0].sequence).toBe(1);
      expect(result[1].sequence).toBe(2);
    });

    it('should use pagination when beforeSequence is provided', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getMessages({
        threadId,
        userId,
        beforeSequence: 100,
      });

      // Assert - should use query builder (pagination)
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should use pagination when afterSequence is provided', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getMessages({
        threadId,
        userId,
        afterSequence: 50,
      });

      // Assert - should use query builder (pagination)
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should return all messages when no pagination parameters provided', async () => {
      // Arrange
      const mockMessages = [
        { id: 'msg-1', sequence: 0 },
        { id: 'msg-2', sequence: 1 },
      ] as ConversationMessage[];

      mockRepository.find.mockResolvedValue(mockMessages);

      // Act
      const result = await service.getMessages({
        threadId,
        userId,
      });

      // Assert - should call getThreadMessages (no pagination)
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { sequence: 'ASC' },
      });
      expect(result).toEqual(mockMessages);
    });

    it('should return both user and assistant messages (bug fix verification)', async () => {
      // Arrange - simulate a conversation with user and assistant messages
      const mockMessages = [
        {
          id: 'msg-1',
          threadId,
          userId,
          type: ConversationMessageType.USER,
          content: 'Hello',
          sequence: 0,
          metadata: null,
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          threadId,
          userId,
          type: ConversationMessageType.ASSISTANT,
          content: 'Hi there!',
          sequence: 1,
          metadata: { traceIds: ['trace-1'] },
          createdAt: new Date(),
        },
      ] as ConversationMessage[];

      mockRepository.find.mockResolvedValue(mockMessages);

      // Act - call with default limit (should NOT trigger pagination)
      const result = await service.getMessages({
        threadId,
        userId,
        limit: 50, // Default limit should NOT trigger pagination
      });

      // Assert - should return both message types
      expect(result.length).toBe(2);
      expect(result[0].type).toBe(ConversationMessageType.USER);
      expect(result[1].type).toBe(ConversationMessageType.ASSISTANT);
      expect(mockRepository.find).toHaveBeenCalled(); // Should use getThreadMessages
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled(); // Should NOT paginate
    });
  });

  describe('getMessageCount', () => {
    it('should return count of messages for a thread', async () => {
      // Arrange
      mockRepository.count.mockResolvedValue(42);

      // Act
      const result = await service.getMessageCount('thread-123');

      // Assert
      expect(result).toBe(42);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { threadId: 'thread-123' },
      });
    });
  });

  describe('deleteThreadMessages', () => {
    it('should delete all messages for a thread', async () => {
      // Arrange
      mockRepository.delete.mockResolvedValue({ affected: 5 });

      // Act
      await service.deleteThreadMessages('thread-123');

      // Assert
      expect(mockRepository.delete).toHaveBeenCalledWith({
        threadId: 'thread-123',
      });
    });
  });
});
