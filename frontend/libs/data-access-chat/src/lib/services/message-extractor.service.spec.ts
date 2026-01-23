import { TestBed } from '@angular/core/testing';
import { MessageExtractorService } from './message-extractor.service';
import { ReasoningTrace, MessageType, AssistantMessage } from '@stocks-researcher/types';

describe('MessageExtractorService', () => {
  let service: MessageExtractorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageExtractorService],
    });
    service = TestBed.inject(MessageExtractorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('extractMessagesFromTraces', () => {
    it('should extract user message from observer node', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: {
            messages: [
              {
                lc: 1,
                kwargs: {
                  content: 'Hello AI',
                },
              },
            ],
          },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe(MessageType.USER);
      expect(messages[0].content).toBe('Hello AI');
    });

    it('should extract AI response from end node', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: {
            final_report: 'Analysis complete. Portfolio looks good.',
          },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe(MessageType.ASSISTANT);
      expect(messages[0].content).toBe('Analysis complete. Portfolio looks good.');
    });

    it('should extract both user message and AI response', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: {
            messages: [
              {
                lc: 1,
                kwargs: { content: 'Analyze AAPL' },
              },
            ],
          },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'trace-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: {
            final_report: 'AAPL analysis: Strong buy signal.',
          },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      expect(messages.length).toBe(2);
      expect(messages[0].type).toBe(MessageType.USER);
      expect(messages[0].content).toBe('Analyze AAPL');
      expect(messages[1].type).toBe(MessageType.ASSISTANT);
      expect(messages[1].content).toBe('AAPL analysis: Strong buy signal.');
    });

    it('should link AI message to trace IDs', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'guardrail',
          input: {},
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'trace-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: {
            final_report: 'Done',
          },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      const aiMessage = messages.find((m) => m.type === MessageType.ASSISTANT) as any;
      expect(aiMessage).toBeDefined();
      expect(aiMessage.traceIds).toEqual(['trace-1', 'trace-2']);
    });

    it('should handle empty traces array', () => {
      const messages = service.extractMessagesFromTraces([]);

      expect(messages).toEqual([]);
    });

    it('should extract multiple message pairs from multiple conversation turns', () => {
      const traces: ReasoningTrace[] = [
        // First conversation turn
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: {
            messages: [
              {
                lc: 1,
                kwargs: { content: 'Analyze AAPL' },
              },
            ],
          },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'trace-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'technical_agent',
          input: {},
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:02Z',
        },
        {
          id: 'trace-3',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: {
            final_report: 'AAPL looks strong. Buy recommendation.',
          },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
        // Second conversation turn
        {
          id: 'trace-4',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: {
            messages: [
              {
                lc: 1,
                kwargs: { content: 'What about TSLA?' },
              },
            ],
          },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:01:00Z',
        },
        {
          id: 'trace-5',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'technical_agent',
          input: {},
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:01:02Z',
        },
        {
          id: 'trace-6',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: {
            final_report: 'TSLA is overvalued. Hold recommendation.',
          },
          reasoning: '',
          createdAt: '2024-01-01T10:01:05Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      // Should extract all 4 messages (2 user + 2 AI)
      expect(messages.length).toBe(4);

      // Verify chronological order
      expect(messages[0].type).toBe(MessageType.USER);
      expect(messages[0].content).toBe('Analyze AAPL');
      expect(messages[0].id).toBe('user-trace-1');

      expect(messages[1].type).toBe(MessageType.ASSISTANT);
      expect(messages[1].content).toBe('AAPL looks strong. Buy recommendation.');
      expect(messages[1].id).toBe('ai-trace-3');

      expect(messages[2].type).toBe(MessageType.USER);
      expect(messages[2].content).toBe('What about TSLA?');
      expect(messages[2].id).toBe('user-trace-4');

      expect(messages[3].type).toBe(MessageType.ASSISTANT);
      expect(messages[3].content).toBe('TSLA is overvalued. Hold recommendation.');
      expect(messages[3].id).toBe('ai-trace-6');
    });

    it('should correctly link traces to each AI message in multi-turn conversations', () => {
      const traces: ReasoningTrace[] = [
        // First turn
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: { messages: [{ lc: 1, kwargs: { content: 'First message' } }] },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'trace-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'technical_agent',
          input: {},
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:02Z',
        },
        {
          id: 'trace-3',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: { final_report: 'First response' },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
        // Second turn
        {
          id: 'trace-4',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: { messages: [{ lc: 1, kwargs: { content: 'Second message' } }] },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:01:00Z',
        },
        {
          id: 'trace-5',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'macro_agent',
          input: {},
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:01:02Z',
        },
        {
          id: 'trace-6',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: { final_report: 'Second response' },
          reasoning: '',
          createdAt: '2024-01-01T10:01:05Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      // First AI message should link to traces 1, 2, 3
      const firstAIMessage = messages.find((m) => m.id === 'ai-trace-3') as AssistantMessage;
      expect(firstAIMessage.traceIds).toEqual(['trace-1', 'trace-2', 'trace-3']);

      // Second AI message should link to traces 4, 5, 6
      const secondAIMessage = messages.find((m) => m.id === 'ai-trace-6') as AssistantMessage;
      expect(secondAIMessage.traceIds).toEqual(['trace-4', 'trace-5', 'trace-6']);
    });

    it('should handle three or more conversation turns', () => {
      const traces: ReasoningTrace[] = [
        // Turn 1
        {
          id: 'obs-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: { messages: [{ lc: 1, kwargs: { content: 'Message 1' } }] },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'end-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: { final_report: 'Response 1' },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
        // Turn 2
        {
          id: 'obs-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: { messages: [{ lc: 1, kwargs: { content: 'Message 2' } }] },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:01:00Z',
        },
        {
          id: 'end-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: { final_report: 'Response 2' },
          reasoning: '',
          createdAt: '2024-01-01T10:01:05Z',
        },
        // Turn 3
        {
          id: 'obs-3',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: { messages: [{ lc: 1, kwargs: { content: 'Message 3' } }] },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:02:00Z',
        },
        {
          id: 'end-3',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: { final_report: 'Response 3' },
          reasoning: '',
          createdAt: '2024-01-01T10:02:05Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      expect(messages.length).toBe(6);
      
      // Verify all messages are in chronological order
      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Response 1');
      expect(messages[2].content).toBe('Message 2');
      expect(messages[3].content).toBe('Response 2');
      expect(messages[4].content).toBe('Message 3');
      expect(messages[5].content).toBe('Response 3');
    });

    it('should handle in-progress conversation (observer without end)', () => {
      const traces: ReasoningTrace[] = [
        // Completed turn
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: { messages: [{ lc: 1, kwargs: { content: 'First message' } }] },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'trace-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: { final_report: 'First response' },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
        // In-progress turn (no end trace yet)
        {
          id: 'trace-3',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: { messages: [{ lc: 1, kwargs: { content: 'Second message' } }] },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:01:00Z',
        },
        {
          id: 'trace-4',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'technical_agent',
          input: {},
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:01:02Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      // Should extract 3 messages: 2 from first turn + 1 user message from second turn
      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('First response');
      expect(messages[2].content).toBe('Second message');
      // No AI response yet for second message
    });

    it('should handle traces without observer or end nodes', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'guardrail',
          input: {},
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      expect(messages).toEqual([]);
    });

    it('should preserve timestamps from traces', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: {
            messages: [{ lc: 1, kwargs: { content: 'Test' } }],
          },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:30:45Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      expect(messages[0].timestamp).toBe('2024-01-01T10:30:45Z');
    });

    it('should generate unique IDs for messages', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: {
            messages: [{ lc: 1, kwargs: { content: 'Test' } }],
          },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'trace-2',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'end',
          input: {},
          output: { final_report: 'Done' },
          reasoning: '',
          createdAt: '2024-01-01T10:00:05Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      expect(messages[0].id).toBeTruthy();
      expect(messages[1].id).toBeTruthy();
      expect(messages[0].id).not.toBe(messages[1].id);
    });

    it('should handle multiple user messages in observer input', () => {
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId: 'thread-123',
          userId: 'user-1',
          nodeName: 'observer',
          input: {
            messages: [
              { lc: 1, kwargs: { content: 'First message' } },
              { lc: 1, kwargs: { content: 'Second message' } },
            ],
          },
          output: {},
          reasoning: '',
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      const messages = service.extractMessagesFromTraces(traces);

      // Should extract the most recent user message
      expect(messages.length).toBeGreaterThanOrEqual(1);
      const userMessage = messages.find((m) => m.type === MessageType.USER);
      expect(userMessage).toBeDefined();
    });
  });
});
