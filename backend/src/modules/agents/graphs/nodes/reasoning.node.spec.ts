import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { CIOState } from '../types';
import { reasoningNode } from './reasoning.node';

interface MockLLM {
  invoke: jest.Mock;
  bindTools: jest.Mock;
}

// Mock @langchain/google-genai
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => {
    const mockLLM = {
      invoke: jest.fn().mockResolvedValue(new AIMessage('Mocked LLM response')),
      bindTools: jest.fn().mockReturnThis(),
    };
    return mockLLM;
  }),
}));

describe('reasoningNode', () => {
  const createState = (messages: BaseMessage[]): CIOState => ({
    userId: 'user-123',
    threadId: 'thread-123',
    messages: messages,
    errors: [],
    iteration: 0,
    maxIterations: 10,
    portfolio: { id: 'p1', positions: [] },
  });

  const mockCountTokens = jest.fn();

  const createConfig = (): RunnableConfig => ({
    callbacks: [],
    configurable: {
      toolRegistry: {
        getTools: jest.fn().mockReturnValue([]),
        getTool: jest.fn(),
      },
      geminiLlmService: {
        getChatModel: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue(new AIMessage('Mocked Result')),
          bindTools: jest.fn().mockReturnThis(),
        }),
        countTokens: mockCountTokens,
      },
    },
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    jest.clearAllMocks();
    mockCountTokens.mockResolvedValue({ totalTokens: 10 }); // Default low token count
  });

  it('should construct prompt with SystemMessage and History', async () => {
    const history = [new HumanMessage('Hello'), new AIMessage('Hi there')];
    const lastMessage = new HumanMessage('Analyze AAPL');
    const state = createState([...history, lastMessage]);
    const config = createConfig();

    await reasoningNode(state, config);

    const geminiService = config.configurable?.geminiLlmService as {
      getChatModel: jest.Mock;
    };
    const mockLLM = geminiService.getChatModel() as MockLLM;
    expect(mockLLM.invoke).toHaveBeenCalled();
    const args = (mockLLM.invoke.mock.calls as any[][])[0][0] as BaseMessage[];

    // Expect [SystemMessage, Human, AI, Human]
    expect(Array.isArray(args)).toBe(true);
    expect(args[0]).toBeInstanceOf(SystemMessage);
    expect(args[0].content).toContain('Chief Investment Officer');
    // Verify history is preserved
    expect(args[1]).toEqual(history[0]);
    expect(args[2]).toEqual(history[1]);
    expect(args[3]).toEqual(lastMessage);
  });

  it('should use buildReasoningPrompt for SystemMessage content', async () => {
    const state = createState([new HumanMessage('Test')]);
    const config = createConfig();

    await reasoningNode(state, config);

    const geminiService = config.configurable?.geminiLlmService as {
      getChatModel: jest.Mock;
    };
    const mockLLM = geminiService.getChatModel() as MockLLM;
    const args = (mockLLM.invoke.mock.calls as any[][])[0][0] as BaseMessage[];
    const systemMsg = args[0] as SystemMessage;

    // Verify it doesn't contain the user query (old behavior)
    expect(systemMsg.content).not.toContain('User Query: Test');
    // Verify it contains portfolio context
    expect(systemMsg.content).toContain('Portfolio ID: p1');
  });

  it('should truncate history if token limit exceeded (Sliding Window)', async () => {
    // Setup history with 3 messages
    const state = createState([
      new HumanMessage('Oldest'),
      new AIMessage('Old'),
      new HumanMessage('Recent'),
      new HumanMessage('Latest'),
    ]);
    const config = createConfig();

    // Mock countTokens to simulate high usage
    // System + Latest = 5000 tokens
    // Recent = 10000 tokens
    // Old = 10000 tokens (Should be dropped as 5000+10000+10000 > 20000)
    mockCountTokens.mockImplementation(async (content) => {
      await Promise.resolve(); // satisfying require-await
      if (typeof content === 'string' && content.includes('Chief'))
        return { totalTokens: 2000 };
      if (content === 'Latest') return { totalTokens: 1000 };
      if (content === 'Recent') return { totalTokens: 15000 };
      if (content === 'Old') return { totalTokens: 5000 };
      return { totalTokens: 100 };
    });

    await reasoningNode(state, config);

    const geminiService = config.configurable?.geminiLlmService as {
      getChatModel: jest.Mock;
    };
    const mockLLM = geminiService.getChatModel() as MockLLM;
    const args = (mockLLM.invoke.mock.calls as any[][])[0][0] as BaseMessage[];

    // Expected: System (2000) + Recent (15000) + Latest (1000) = 18000 < 20000.
    // 'Old' (5000) would make it 23000, so it should be dropped.
    // 'Oldest' is before 'Old', so implicitly dropped too.

    // Note: Our implementation iterates backwards.
    // 1. Current = 3000 (System+Latest)
    // 2. Add Recent (15000) -> 18000. OK. History: [Recent]
    // 3. Add Old (5000) -> 23000. STOP.

    // Result array: [System, Recent, Latest]
    expect(args.length).toBe(3);
    expect(args[1].content).toBe('Recent');
    expect(args[2].content).toBe('Latest');
  });

  it('should handle tool binding from registry', async () => {
    const state = createState([new HumanMessage('Test')]);
    const config = createConfig();
    const mockTools = [{ name: 'tool1' }];
    const toolRegistry = config.configurable?.toolRegistry as {
      getTools: jest.Mock;
    };
    toolRegistry.getTools.mockReturnValue(mockTools);

    await reasoningNode(state, config);

    const geminiService = config.configurable?.geminiLlmService as {
      getChatModel: jest.Mock;
    };
    const mockLLM = geminiService.getChatModel() as MockLLM;
    expect(mockLLM.bindTools).toHaveBeenCalledWith(mockTools);
  });
});
