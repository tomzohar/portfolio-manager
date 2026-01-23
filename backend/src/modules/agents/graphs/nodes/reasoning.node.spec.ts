import { reasoningNode } from './reasoning.node';
import { CIOState } from '../types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { buildReasoningPrompt } from '../../prompts';
import { Callbacks } from '@langchain/core/callbacks/manager';

// Mock @langchain/google-genai
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => {
    const mockLLM = {
      invoke: jest.fn().mockResolvedValue({
        content: 'Mocked LLM response with market analysis',
        additional_kwargs: {},
      }),
      bindTools: jest.fn().mockReturnThis(),
    };
    // Make bindTools return the llm itself for chaining
    mockLLM.bindTools.mockReturnValue(mockLLM);
    return mockLLM;
  }),
}));

describe('reasoningNode', () => {
  const createState = (message: string): CIOState => ({
    userId: 'user-123',
    threadId: 'thread-123',
    messages: [new HumanMessage(message)],
    errors: [],
    iteration: 0,
    maxIterations: 10,
  });

  const createConfig = (): RunnableConfig => ({
    callbacks: [],
    configurable: {
      toolRegistry: {
        getTools: jest.fn().mockReturnValue([]),
        getTool: jest.fn(),
      },
    },
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash-exp';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  it('should generate a response using streaming LLM with tools', async () => {
    const state = createState('Analyze the technology sector');
    const config = createConfig();

    const result = await reasoningNode(state, config);

    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBe(1);
    expect(result.messages?.[0]).toBeInstanceOf(Object); // AIMessage-like object
    expect(result.messages?.[0].content).toBe(
      'Mocked LLM response with market analysis',
    );
  });

  it('should bind tools to LLM when toolRegistry is available', async () => {
    const mockTools = [{ name: 'test_tool', description: 'A test tool' }];
    const state = createState('Test query');
    const config: RunnableConfig = {
      callbacks: [],
      configurable: {
        toolRegistry: {
          getTools: jest.fn().mockReturnValue(mockTools),
          getTool: jest.fn(),
        },
      },
    };

    await reasoningNode(state, config);

    // Verify bindTools was called with the tools
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mockInstance =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ChatGoogleGenerativeAI.mock.results[
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ChatGoogleGenerativeAI.mock.results.length - 1
      ].value;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(mockInstance.bindTools).toHaveBeenCalledWith(mockTools);
  });

  it('should not increment iteration count (handled by guardrail)', async () => {
    const state = createState('Market outlook?');
    const config = createConfig();

    const result = await reasoningNode(state, config);

    // Reasoning node no longer increments iteration - guardrail does this
    expect(result.iteration).toBeUndefined();
  });

  it('should handle missing API key gracefully', async () => {
    delete process.env.GEMINI_API_KEY;
    const state = createState('Test query');
    const config = createConfig();

    const result = await reasoningNode(state, config);

    expect(result.errors).toBeDefined();
    expect(result.errors).toContain('GEMINI_API_KEY not configured');
    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBe(1);
    expect(result.messages?.[0].content).toContain('missing configuration');
  });

  it('should handle LLM errors gracefully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ChatGoogleGenerativeAI.mockImplementationOnce(() => {
      const mockLLM = {
        invoke: jest.fn().mockRejectedValue(new Error('LLM API error')),
        bindTools: jest.fn().mockReturnThis(),
      };
      mockLLM.bindTools.mockReturnValue(mockLLM);
      return mockLLM;
    });

    const state = createState('Test query');
    const config = createConfig();

    const result = await reasoningNode(state, config);

    expect(result.errors).toBeDefined();
    expect(result.errors).toContain('LLM API error');
    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBe(1);
    expect(result.messages?.[0].content).toContain(
      'error while processing your request',
    );
  });

  it('should pass callbacks to LLM for tracing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
    const mockInvoke = jest.fn().mockResolvedValue({
      content: 'Response',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ChatGoogleGenerativeAI.mockImplementationOnce(() => ({
      invoke: mockInvoke,
    }));

    const state = createState('Test query');
    const mockCallbacks = [{ name: 'TestCallback' }];
    const config = createConfig();
    config.callbacks = mockCallbacks as Callbacks;

    await reasoningNode(state, config);

    expect(mockInvoke).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const invokeArgs = mockInvoke.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const callConfig = invokeArgs[1];
    expect(callConfig).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(callConfig.callbacks).toBe(mockCallbacks);
  });

  it('should use prompt builder to format prompt', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
    const mockInvoke = jest.fn().mockResolvedValue({
      content: 'Response',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ChatGoogleGenerativeAI.mockImplementationOnce(() => ({
      invoke: mockInvoke,
    }));

    const testQuery = 'What is the market outlook?';
    const state = createState(testQuery);
    const config = createConfig();

    await reasoningNode(state, config);

    expect(mockInvoke).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const invokeArgs = mockInvoke.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const promptUsed = invokeArgs[0];

    // Verify prompt was built correctly
    const expectedPrompt = buildReasoningPrompt(testQuery);
    expect(promptUsed).toBe(expectedPrompt);
    expect(promptUsed).toContain(testQuery);
    expect(promptUsed).toContain('Chief Investment Officer');
  });
});
