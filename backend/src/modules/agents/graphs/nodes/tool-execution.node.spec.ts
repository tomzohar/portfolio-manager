import { toolExecutionNode } from './tool-execution.node';
import { CIOState } from '../types';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

describe('toolExecutionNode', () => {
  let mockToolRegistry: {
    getTool: jest.Mock;
    getTools: jest.Mock;
  };

  let mockConfig: {
    configurable?: {
      toolRegistry?: {
        getTool: jest.Mock;
        getTools: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    mockToolRegistry = {
      getTool: jest.fn(),
      getTools: jest.fn(),
    };

    mockConfig = {
      configurable: {
        toolRegistry: mockToolRegistry,
      },
    };
  });

  describe('Tool Call Execution', () => {
    it('should execute tool when AIMessage contains tool_calls', async () => {
      // Create a mock tool
      const mockTool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'A test tool',
        schema: z.object({
          query: z.string(),
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        func: async ({ query }: { query: string }) => {
          return JSON.stringify({ result: `Processed: ${query}` });
        },
      });

      mockToolRegistry.getTool.mockReturnValue(mockTool);

      // Create state with tool call
      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new HumanMessage('Test query'),
          new AIMessage({
            content: 'I will use the test tool',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: JSON.stringify({ query: 'test query' }),
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBe(1);
      expect(result.messages?.[0]).toBeInstanceOf(ToolMessage);

      const toolMessage = result.messages?.[0] as ToolMessage;
      expect(toolMessage.content).toContain('Processed: test query');
      expect(toolMessage.tool_call_id).toBe('call_123');
    });

    it('should execute multiple tool calls in parallel', async () => {
      const mockTool1 = new DynamicStructuredTool({
        name: 'tool_1',
        description: 'Tool 1',
        schema: z.object({ value: z.string() }),
        // eslint-disable-next-line @typescript-eslint/require-await
        func: async () => JSON.stringify({ result: 'Tool 1 result' }),
      });

      const mockTool2 = new DynamicStructuredTool({
        name: 'tool_2',
        description: 'Tool 2',
        schema: z.object({ value: z.string() }),
        // eslint-disable-next-line @typescript-eslint/require-await
        func: async () => JSON.stringify({ result: 'Tool 2 result' }),
      });

      mockToolRegistry.getTool.mockImplementation((name: string) => {
        if (name === 'tool_1') return mockTool1;
        if (name === 'tool_2') return mockTool2;
        return null;
      });

      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new HumanMessage('Test query'),
          new AIMessage({
            content: 'I will use multiple tools',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'tool_1',
                    arguments: JSON.stringify({ value: 'test1' }),
                  },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'tool_2',
                    arguments: JSON.stringify({ value: 'test2' }),
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      expect(result.messages?.length).toBe(2);
      expect(result.messages?.[0]).toBeInstanceOf(ToolMessage);
      expect(result.messages?.[1]).toBeInstanceOf(ToolMessage);
    });

    it('should return empty update when no tool calls present', async () => {
      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [new HumanMessage('Test query'), new AIMessage('Response')],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      expect(result).toEqual({});
    });

    it('should return empty update when messages array is empty', async () => {
      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      expect(result).toEqual({});
    });

    it('should execute tool when AIMessage contains Gemini functionCall format in content array', async () => {
      // Create mock tools
      const mockTechnicalAnalyst = new DynamicStructuredTool({
        name: 'technical_analyst',
        description: 'Analyzes technical indicators',
        schema: z.object({
          ticker: z.string(),
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        func: async ({ ticker }: { ticker: string }) => {
          return JSON.stringify({
            ticker,
            analysis: 'Technical analysis result',
            indicators: { rsi: 65, macd: 'bullish' },
          });
        },
      });

      const mockMacroAnalyst = new DynamicStructuredTool({
        name: 'macro_analyst',
        description: 'Analyzes macro conditions',
        schema: z.object({}),
        // eslint-disable-next-line @typescript-eslint/require-await
        func: async () => {
          return JSON.stringify({
            analysis: 'Macro analysis result',
            indicators: { gdp: 'growing', inflation: 'moderate' },
          });
        },
      });

      mockToolRegistry.getTool.mockImplementation((name: string) => {
        if (name === 'technical_analyst') return mockTechnicalAnalyst;
        if (name === 'macro_analyst') return mockMacroAnalyst;
        return null;
      });

      // Create state with Gemini functionCall format
      // This mimics what Gemini returns: content is an array with functionCall objects
      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new HumanMessage('Analyze IREN stock'),
          new AIMessage({
            content: [
              {
                type: 'functionCall',
                functionCall: {
                  name: 'technical_analyst',
                  args: { ticker: 'IREN' },
                },
              },
              {
                type: 'functionCall',
                functionCall: {
                  name: 'macro_analyst',
                  args: {},
                },
              },
            ],
            additional_kwargs: {},
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      // Should execute both tool calls
      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBe(2);
      expect(result.messages?.[0]).toBeInstanceOf(ToolMessage);
      expect(result.messages?.[1]).toBeInstanceOf(ToolMessage);

      // Check first tool result
      const toolMessage1 = result.messages?.[0] as ToolMessage;
      expect(toolMessage1.content).toContain('Technical analysis result');
      expect(toolMessage1.content).toContain('IREN');

      // Check second tool result
      const toolMessage2 = result.messages?.[1] as ToolMessage;
      expect(toolMessage2.content).toContain('Macro analysis result');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool not found error gracefully', async () => {
      mockToolRegistry.getTool.mockReturnValue(null);

      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new HumanMessage('Test query'),
          new AIMessage({
            content: 'Using tool',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'non_existent_tool',
                    arguments: JSON.stringify({ query: 'test' }),
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      expect(result.messages?.length).toBe(1);
      const toolMessage = result.messages?.[0] as ToolMessage;
      expect(toolMessage.content).toContain('not found');
    });

    it('should handle invalid JSON arguments gracefully', async () => {
      const mockTool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'Test tool',
        schema: z.object({ query: z.string() }),
        // eslint-disable-next-line @typescript-eslint/require-await
        func: async () => 'result',
      });

      mockToolRegistry.getTool.mockReturnValue(mockTool);

      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new HumanMessage('Test query'),
          new AIMessage({
            content: 'Using tool',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: 'invalid json{',
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      expect(result.messages?.length).toBe(1);
      const toolMessage = result.messages?.[0] as ToolMessage;
      expect(toolMessage.content).toContain('Failed to parse');
    });

    it('should handle tool execution errors gracefully', async () => {
      const errorTool = new DynamicStructuredTool({
        name: 'error_tool',
        description: 'Tool that throws error',
        schema: z.object({ query: z.string() }),
        // eslint-disable-next-line @typescript-eslint/require-await
        func: async () => {
          throw new Error('Tool execution failed');
        },
      });

      mockToolRegistry.getTool.mockReturnValue(errorTool);

      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new HumanMessage('Test query'),
          new AIMessage({
            content: 'Using tool',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'error_tool',
                    arguments: JSON.stringify({ query: 'test' }),
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      expect(result.messages?.length).toBe(1);
      const toolMessage = result.messages?.[0] as ToolMessage;
      expect(toolMessage.content).toContain('Tool execution failed');
    });

    it('should return error when toolRegistry is not in config', async () => {
      const configWithoutRegistry = {
        configurable: {},
      };

      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new HumanMessage('Test query'),
          new AIMessage({
            content: 'Using tool',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: JSON.stringify({ query: 'test' }),
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, configWithoutRegistry);

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('ToolRegistry not available');
    });
  });

  describe('Proactive Earnings Warning', () => {
    it('should inject warning when technical_analyst is called and earnings are imminent', async () => {
      // Mock technical_analyst tool
      const mockTechTool = new DynamicStructuredTool({
        name: 'technical_analyst',
        description: 'Tech analysis',
        schema: z.object({ ticker: z.string() }),
        func: async ({ ticker }) => {
          return Promise.resolve(
            JSON.stringify({ ticker, analysis: 'Bullish' }),
          );
        },
      });

      // Mock earnings_calendar tool with imminent earnings
      const mockEarningsTool = new DynamicStructuredTool({
        name: 'earnings_calendar',
        description: 'Earnings cal',
        schema: z.object({ symbol: z.string(), days_ahead: z.number() }),
        func: async () => {
          return Promise.resolve(
            JSON.stringify({
              upcoming_earnings: [{ date: '2026-01-30', hour: 'AMC' }],
            }),
          );
        },
      });

      mockToolRegistry.getTool.mockImplementation((name) => {
        if (name === 'technical_analyst') return mockTechTool;
        if (name === 'earnings_calendar') return mockEarningsTool;
        return null;
      });

      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new AIMessage({
            content: '',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_tech',
                  type: 'function',
                  function: {
                    name: 'technical_analyst',
                    arguments: JSON.stringify({ ticker: 'AAPL' }),
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      const toolMessage = result.messages?.[0] as ToolMessage;
      expect(toolMessage.content).toContain('PROACTIVE RISK WARNING');
      expect(toolMessage.content).toContain('2026-01-30');
    });

    it('should NOT inject warning when no earnings are imminent', async () => {
      const mockTechTool = new DynamicStructuredTool({
        name: 'technical_analyst',
        description: 'Tech analysis',
        schema: z.object({ ticker: z.string() }),
        func: async ({ ticker }) => {
          return Promise.resolve(
            JSON.stringify({ ticker, analysis: 'Bullish' }),
          );
        },
      });

      const mockEarningsTool = new DynamicStructuredTool({
        name: 'earnings_calendar',
        description: 'Earnings cal',
        schema: z.object({ symbol: z.string(), days_ahead: z.number() }),
        func: async () => {
          return Promise.resolve(JSON.stringify({ upcoming_earnings: [] }));
        },
      });

      mockToolRegistry.getTool.mockImplementation((name) => {
        if (name === 'technical_analyst') return mockTechTool;
        if (name === 'earnings_calendar') return mockEarningsTool;
        return null;
      });

      const state: CIOState = {
        userId: 'test-user',
        threadId: 'test-thread',
        messages: [
          new AIMessage({
            content: '',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_tech',
                  type: 'function',
                  function: {
                    name: 'technical_analyst',
                    arguments: JSON.stringify({ ticker: 'AAPL' }),
                  },
                },
              ],
            },
          }),
        ],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = await toolExecutionNode(state, mockConfig);

      const toolMessage = result.messages?.[0] as ToolMessage;
      expect(toolMessage.content).not.toContain('PROACTIVE RISK WARNING');
    });
  });
});
