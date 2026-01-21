import { TestBed } from '@angular/core/testing';
import { MessageExtractorService } from './message-extractor.service';
import { ReasoningTrace, MessageType, ConversationMessage } from '@stocks-researcher/types';

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
