import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { CIOState } from '../types';
import { summarizationNode } from './summarization.node';

describe('summarizationNode', () => {
  const createState = (messages: BaseMessage[]): CIOState => ({
    userId: 'user-1',
    threadId: 'thread-1',
    messages: messages,
    errors: [],
    iteration: 0,
    maxIterations: 10,
  });

  const mockCountTokens = jest.fn();
  const mockInvoke = jest.fn();
  const mockWithStructuredOutput = jest
    .fn()
    .mockReturnValue({ invoke: mockInvoke });

  const createConfig = (): RunnableConfig => ({
    callbacks: [],
    configurable: {
      geminiLlmService: {
        countTokens: mockCountTokens,
        getChatModel: jest.fn().mockReturnValue({
          withStructuredOutput: mockWithStructuredOutput,
        }),
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not summarize if tokens effectively below threshold', async () => {
    const state = createState([new HumanMessage('Hello')]);
    const config = createConfig();
    mockCountTokens.mockResolvedValue({ totalTokens: 100 });

    const result = await summarizationNode(state, config);

    expect(result).toEqual({});
    expect(mockWithStructuredOutput).not.toHaveBeenCalled();
  });

  it('should summarize if tokens exceed threshold', async () => {
    // Create 20 messages (enough to trigger length check > 10+1)
    const msgs = Array(20).fill(
      new HumanMessage('Long content'),
    ) as BaseMessage[];
    const state = createState(msgs);
    const config = createConfig();

    // 20 messages * 2000 tokens = 40000 > 30000 threshold
    mockCountTokens.mockResolvedValue({ totalTokens: 2000 });

    mockInvoke.mockResolvedValue({
      summary: 'Condensed summary',
      key_decisions: ['Decision 1'],
    });

    const result = await summarizationNode(state, config);

    expect(mockWithStructuredOutput).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalled();
    expect(result.messages).toBeDefined();
    const summaryMsg = result.messages?.[0] as SystemMessage;

    expect(summaryMsg.content).toContain('PREVIOUS CONVERSATION SUMMARY');
    expect(summaryMsg.content).toContain('Condensed summary');
    expect(summaryMsg.content).toContain('Decision 1');
  });

  it('should skip summarization if Gemini service is missing', async () => {
    const state = createState([]);
    const config: RunnableConfig = { callbacks: [] };

    const result = await summarizationNode(state, config);
    expect(result).toEqual({});
  });
});
