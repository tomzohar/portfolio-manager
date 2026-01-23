import { MessageType, ConversationMessage, UserMessage, AssistantMessage, PendingSentMessage } from '@stocks-researcher/types';
import { ChatState, initialChatState } from './chat.state';
import {
  selectMessages,
  selectSentMessages,
  selectDisplayMessages,
  selectNextSequence,
} from './chat.selectors';

/**
 * Unit tests for Chat Selectors
 * 
 * Focus: selectDisplayMessages selector that combines extracted messages with optimistic pending messages
 * 
 * Test Coverage:
 * - Empty state (no messages)
 * - Only extracted messages (from traces)
 * - Only pending messages (optimistic)
 * - Combination of extracted and pending messages
 * - Chronological ordering
 * - Optimistic flag presence
 */
describe('ChatSelectors', () => {
  describe('selectDisplayMessages', () => {
    it('should return empty array when no messages and no pending messages', () => {
      const result = selectDisplayMessages.projector([], []);

      expect(result).toEqual([]);
    });

    it('should return only extracted messages when no pending messages', () => {
      const extractedMessages: ConversationMessage[] = [
        {
          id: 'msg-1',
          type: MessageType.USER,
          content: 'Hello',
          timestamp: '2024-01-01T10:00:00Z',
        } as UserMessage,
        {
          id: 'msg-2',
          type: MessageType.ASSISTANT,
          content: 'Hi there!',
          timestamp: '2024-01-01T10:00:05Z',
          traceIds: ['trace-1'],
        } as AssistantMessage,
      ];

      const result = selectDisplayMessages.projector(extractedMessages, []);

      expect(result).toEqual(extractedMessages);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('should create optimistic user messages for pending sent messages', () => {
      const sentMessages: PendingSentMessage[] = [{
        content: 'How are you?',
        timestamp: '2024-01-01T10:00:10Z',
        sequence: 2,
      }];

      const result = selectDisplayMessages.projector([], sentMessages);

      expect(result.length).toBe(1);
      expect(result[0].type).toBe(MessageType.USER);
      expect(result[0].content).toBe('How are you?');
      expect((result[0] as UserMessage).isOptimistic).toBe(true);
      expect(result[0].id).toBe('optimistic-2');
      expect(result[0].sequence).toBe(2);
      expect(result[0].timestamp).toBe('2024-01-01T10:00:10Z');
    });

    it('should combine extracted messages with optimistic pending messages', () => {
      const extractedMessages: ConversationMessage[] = [
        {
          id: 'msg-1',
          type: MessageType.USER,
          content: 'Hello',
          timestamp: '2024-01-01T10:00:00Z',
          sequence: 0,
        } as UserMessage,
        {
          id: 'msg-2',
          type: MessageType.ASSISTANT,
          content: 'Hi there!',
          timestamp: '2024-01-01T10:00:05Z',
          sequence: 1,
          traceIds: ['trace-1'],
        } as AssistantMessage,
      ];

      const sentMessages: PendingSentMessage[] = [
        { content: 'How are you?', timestamp: '2024-01-01T10:00:10Z', sequence: 2 },
        { content: 'What time is it?', timestamp: '2024-01-01T10:00:15Z', sequence: 3 },
      ];

      const result = selectDisplayMessages.projector(
        extractedMessages,
        sentMessages
      );

      expect(result.length).toBe(4); // 2 extracted + 2 optimistic
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[2].content).toBe('How are you?');
      expect(result[3].content).toBe('What time is it?');
      expect((result[2] as UserMessage).isOptimistic).toBe(true);
      expect((result[3] as UserMessage).isOptimistic).toBe(true);
    });

    it('should sort messages by sequence number first', () => {
      const extractedMessages: ConversationMessage[] = [
        {
          id: 'msg-1',
          type: MessageType.USER,
          content: 'First message',
          timestamp: '2024-01-01T10:00:00Z',
          sequence: 0,
        } as UserMessage,
        {
          id: 'msg-2',
          type: MessageType.ASSISTANT,
          content: 'Second message',
          timestamp: '2024-01-01T10:00:05Z',
          sequence: 1,
          traceIds: ['trace-1'],
        } as AssistantMessage,
      ];

      const sentMessages: PendingSentMessage[] = [{
        content: 'Third message',
        timestamp: '2024-01-01T10:00:10Z',
        sequence: 2,
      }];

      const result = selectDisplayMessages.projector(
        extractedMessages,
        sentMessages
      );

      // Should be sorted by sequence number
      expect(result.length).toBe(3);
      expect(result[0].content).toBe('First message');
      expect(result[0].sequence).toBe(0);
      expect(result[1].content).toBe('Second message');
      expect(result[1].sequence).toBe(1);
      expect(result[2].content).toBe('Third message');
      expect(result[2].sequence).toBe(2);
    });

    it('should create unique optimistic IDs for multiple pending messages', () => {
      const sentMessages: PendingSentMessage[] = [
        { content: 'Message 1', timestamp: '2024-01-01T10:00:00Z', sequence: 0 },
        { content: 'Message 2', timestamp: '2024-01-01T10:00:05Z', sequence: 1 },
        { content: 'Message 3', timestamp: '2024-01-01T10:00:10Z', sequence: 2 },
      ];

      const result = selectDisplayMessages.projector([], sentMessages);

      expect(result.length).toBe(3);
      
      const ids = result.map(msg => msg.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(3); // All IDs should be unique
      expect(ids[0]).toBe('optimistic-0');
      expect(ids[1]).toBe('optimistic-1');
      expect(ids[2]).toBe('optimistic-2');
    });

    it('should handle Date and string timestamps correctly', () => {
      const extractedMessages: ConversationMessage[] = [
        {
          id: 'msg-1',
          type: MessageType.USER,
          content: 'With Date object',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        } as UserMessage,
        {
          id: 'msg-2',
          type: MessageType.ASSISTANT,
          content: 'With string timestamp',
          timestamp: '2024-01-01T10:00:05Z',
          traceIds: ['trace-1'],
        } as AssistantMessage,
      ];

      const result = selectDisplayMessages.projector(
        extractedMessages,
        []
      );

      expect(result.length).toBe(2);
      // Should handle both timestamp formats without errors
      expect(result[0].content).toBe('With Date object');
      expect(result[1].content).toBe('With string timestamp');
    });

    it('should not add optimistic flag to extracted messages', () => {
      const extractedMessages: ConversationMessage[] = [
        {
          id: 'msg-1',
          type: MessageType.USER,
          content: 'Extracted user message',
          timestamp: '2024-01-01T10:00:00Z',
        } as UserMessage,
      ];

      const result = selectDisplayMessages.projector(extractedMessages, []);

      expect((result[0] as UserMessage).isOptimistic).toBeUndefined();
    });

    it('should handle empty strings in sentMessages gracefully', () => {
      const sentMessages: PendingSentMessage[] = [
        { content: 'Valid message', timestamp: '2024-01-01T10:00:00Z', sequence: 0 },
        { content: '', timestamp: '2024-01-01T10:00:05Z', sequence: 1 },
        { content: '  ', timestamp: '2024-01-01T10:00:10Z', sequence: 2 },
        { content: 'Another valid', timestamp: '2024-01-01T10:00:15Z', sequence: 3 },
      ];

      const result = selectDisplayMessages.projector([], sentMessages);

      // Should create optimistic messages for all entries (filtering not selector's responsibility)
      expect(result.length).toBe(4);
    });

    it('should preserve timestamp from pending message (not create new)', () => {
      const capturedTimestamp = '2024-01-01T10:00:00Z';
      const sentMessages: PendingSentMessage[] = [{
        content: 'Test message',
        timestamp: capturedTimestamp,
        sequence: 0,
      }];

      const result = selectDisplayMessages.projector([], sentMessages);

      expect(result[0].timestamp).toBe(capturedTimestamp);
    });

    it('should sort by sequence even if timestamps are out of order', () => {
      const extractedMessages: ConversationMessage[] = [
        {
          id: 'msg-1',
          type: MessageType.USER,
          content: 'Message with sequence 0',
          timestamp: '2024-01-01T10:00:10Z', // Later timestamp
          sequence: 0,
        } as UserMessage,
        {
          id: 'msg-2',
          type: MessageType.ASSISTANT,
          content: 'Message with sequence 1',
          timestamp: '2024-01-01T10:00:05Z', // Earlier timestamp
          sequence: 1,
          traceIds: ['trace-1'],
        } as AssistantMessage,
      ];

      const result = selectDisplayMessages.projector(extractedMessages, []);

      // Should sort by sequence, not timestamp
      expect(result[0].sequence).toBe(0);
      expect(result[1].sequence).toBe(1);
      expect(result[0].content).toBe('Message with sequence 0');
      expect(result[1].content).toBe('Message with sequence 1');
    });
  });

  describe('selectMessages', () => {
    it('should select messages from state', () => {
      const messages: ConversationMessage[] = [
        {
          id: 'msg-1',
          type: MessageType.USER,
          content: 'Test',
          timestamp: '2024-01-01T10:00:00Z',
        } as UserMessage,
      ];

      const state: ChatState = {
        ...initialChatState,
        messages,
      };

      const result = selectMessages.projector(state);

      expect(result).toEqual(messages);
    });
  });

  describe('selectSentMessages', () => {
    it('should select sent messages from state', () => {
      const sentMessages: PendingSentMessage[] = [
        { content: 'Pending 1', timestamp: '2024-01-01T10:00:00Z', sequence: 0 },
        { content: 'Pending 2', timestamp: '2024-01-01T10:00:05Z', sequence: 1 },
      ];

      const state: ChatState = {
        ...initialChatState,
        sentMessages,
      };

      const result = selectSentMessages.projector(state);

      expect(result).toEqual(sentMessages);
    });
  });

  describe('selectNextSequence', () => {
    it('should select next sequence number from state', () => {
      const state: ChatState = {
        ...initialChatState,
        nextSequence: 5,
      };

      const result = selectNextSequence.projector(state);

      expect(result).toBe(5);
    });

    it('should return 0 for initial state', () => {
      const result = selectNextSequence.projector(initialChatState);

      expect(result).toBe(0);
    });
  });
});
