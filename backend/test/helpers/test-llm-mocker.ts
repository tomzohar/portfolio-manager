/* eslint-disable @typescript-eslint/no-unused-vars */
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import {
  GeminiResponse,
  GeminiUsageMetadata,
} from '../../src/modules/agents/services/gemini-llm.service';
import { LLMModels } from '../../src/modules/agents/types/lll-models.enum';

interface MockCallback {
  handleLLMStart?: (run: any, inputs: string[]) => Promise<void>;
  handleLLMNewToken?: (token: string) => Promise<void>;
  handleLLMEnd?: (output: any) => Promise<void>;
}

interface MockConfig {
  callbacks?: MockCallback[];
}

/**
 * Mock Gemini LLM Service
 *
 * Provides instant responses for E2E tests to avoid network calls and timeouts.
 * Supports:
 * 1. LangChain callbacks (for tracing/SSE tests)
 * 2. Conditional tool calling based on prompt keywords (for logic tests)
 * 3. Handling tool results to avoid recursion loops
 */
export const mockGeminiLlmService = {
  // Existing text generation mock
  generateContent: (
    _prompt: string,
    _model?: string,
  ): Promise<GeminiResponse> => {
    return Promise.resolve({
      text: 'Mock LLM response for testing.',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      } as GeminiUsageMetadata,
    });
  },

  // NEW: Mock ChatModel for LangGraph
  getChatModel: (_options: unknown) => {
    // Shared invoke logic to trigger callbacks
    const invokeWithCallbacks = async (
      input: string | BaseMessage | BaseMessage[],
      config?: MockConfig,
    ) => {
      let promptStr = '';

      if (Array.isArray(input)) {
        // Extract prompt from all messages
        promptStr = input
          .map((m) => {
            if (typeof m.content === 'string') return m.content;
            if (Array.isArray(m.content))
              return m.content
                .map((c) =>
                  typeof c === 'string'
                    ? c
                    : (c as { text?: string }).text || '',
                )
                .join(' ');
            return JSON.stringify(m.content);
          })
          .join('\n');
      } else if (typeof input === 'string') {
        promptStr = input;
      } else if (input && input.content) {
        promptStr =
          typeof input.content === 'string'
            ? input.content
            : JSON.stringify(input.content);
      } else {
        promptStr = JSON.stringify(input);
      }

      const prompt = promptStr.toLowerCase();
      if (process.env.NODE_ENV === 'test') {
        console.log(
          'DEBUG LLM MOCK PROMPT (start):',
          prompt.substring(0, 200) + '...',
        );
        if (prompt.length > 500) {
          console.log(
            'DEBUG LLM MOCK PROMPT (end):',
            prompt.substring(prompt.length - 500) + '...',
          );
        }
      }

      // Check for tool outputs in the prompt history to detect if tool has already run
      // We check for MULTIPLE unique fields to ensure it's not just the system prompt description
      const hasTechnicalAnalysis =
        prompt.includes('sma_50') && prompt.includes('current_price');
      const hasMacroAnalysis =
        prompt.includes('gdp_growth') && prompt.includes('inflation_rate');

      if (hasTechnicalAnalysis || hasMacroAnalysis) {
        const finalResponse = new AIMessage({
          content:
            'I have analyzed the data from the tool. Here is the final answer.',
        });

        // Trigger callbacks for the final answer
        if (config?.callbacks) {
          try {
            const callbacks = Array.isArray(config.callbacks)
              ? config.callbacks
              : [config.callbacks];
            for (const callback of callbacks) {
              if (callback.handleLLMStart)
                await callback.handleLLMStart(
                  { name: LLMModels.GEMINI_PRO_LATEST },
                  [promptStr],
                );
              if (callback.handleLLMNewToken) {
                await callback.handleLLMNewToken('I have ');
                await callback.handleLLMNewToken('analyzed ');
                await callback.handleLLMNewToken('the data.');
              }
              if (callback.handleLLMEnd)
                await callback.handleLLMEnd({
                  generations: [
                    [
                      {
                        message: finalResponse,
                        text: finalResponse.content as string,
                      },
                    ],
                  ],
                });
            }
          } catch (e) {
            console.error('Callback error', e);
          }
        }
        return finalResponse;
      }

      let responseMessage: AIMessage;

      // Conditional logic to trigger tools based on prompt keywords
      // PRIORITY: performance queries (must come before analyze aapl to avoid system prompt example matches)
      const isPerformanceQuery =
        prompt.includes('performance') ||
        prompt.includes('return') ||
        prompt.includes('beat') ||
        prompt.includes('portfolio') ||
        prompt.includes('attribution');

      if (isPerformanceQuery) {
        // PREVENTION: If we already have a tool result or error in the prompt, DON'T call it again
        if (
          prompt.includes('error analyzing') ||
          prompt.includes('portfolio not found') ||
          prompt.includes('invalid input syntax') ||
          prompt.includes('portfolio analysis:') ||
          prompt.includes('historical returns:') ||
          prompt.includes('"portfolioreturn"')
        ) {
          if (process.env.NODE_ENV === 'test') {
            console.log(
              'DEBUG MOCK: Loop breaker triggered! Terminating tool call chain.',
            );
          }
          return new AIMessage({
            content:
              "I've analyzed your portfolio performance. Due to some technical limitations in the test environment, I've provided the best summary possible. Is there anything else you'd like to dive into?",
          });
        }

        const callId = `call_${Date.now()}`;

        // Extract portfolioId and userId from prompt context if possible
        const uuidRegex =
          /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;

        const portfolioIdMatch = prompt.match(
          new RegExp(`portfolio id:?\\s*${uuidRegex.source}`, 'i'),
        );
        const userIdMatch =
          prompt.match(new RegExp(`user id:?\\s*${uuidRegex.source}`, 'i')) ||
          prompt.match(new RegExp(`userid="${uuidRegex.source}"`, 'i')) ||
          prompt.match(new RegExp(`threadid="${uuidRegex.source}:`, 'i'));

        let portfolioId = portfolioIdMatch ? portfolioIdMatch[1] : 'unknown';
        const userId = userIdMatch ? userIdMatch[1] : 'unknown';

        if (portfolioId === 'unknown' && userId !== 'unknown') {
          portfolioId = userId;
        }

        if (process.env.NODE_ENV === 'test') {
          console.log(
            `DEBUG MOCK EXTRACTED: portfolioId=${portfolioId}, userId=${userId}`,
          );
          if (
            portfolioId === 'unknown' ||
            (portfolioId !== 'unknown' && portfolioId.length < 30)
          ) {
            console.log('DEBUG MOCK PROMPT (FULL):', prompt);
          }
        }

        responseMessage = new AIMessage({
          content: '',
          tool_calls: [
            {
              name: 'performance_attribution',
              args: { portfolioId, userId, timeframe: 'YTD' },
              id: callId,
            },
          ],
          additional_kwargs: {
            tool_calls: [
              {
                function: {
                  name: 'performance_attribution',
                  arguments: JSON.stringify({
                    portfolioId,
                    userId,
                    timeframe: 'YTD',
                  }),
                },
                type: 'function',
                id: callId,
              },
            ],
          },
        });
      } else if (
        prompt.includes('analyze aapl') ||
        prompt.includes('analyze tsla')
      ) {
        const ticker = prompt.includes('aapl') ? 'AAPL' : 'TSLA';
        const callId = `call_${Date.now()}`;

        responseMessage = new AIMessage({
          content: '',
          tool_calls: [
            {
              name: 'technical_analyst',
              args: { ticker: ticker },
              id: callId,
            },
          ],
          additional_kwargs: {
            tool_calls: [
              {
                function: {
                  name: 'technical_analyst',
                  arguments: JSON.stringify({ ticker: ticker }),
                },
                type: 'function',
                id: callId,
              },
            ],
          },
        });
      } else if (
        prompt.includes('market outlook') ||
        prompt.includes('macro')
      ) {
        const callId = `call_${Date.now()}`;
        responseMessage = new AIMessage({
          content: '',
          tool_calls: [
            {
              name: 'macro_analyst',
              args: {},
              id: callId,
            },
          ],
          additional_kwargs: {
            tool_calls: [
              {
                function: {
                  name: 'macro_analyst',
                  arguments: '{}',
                },
                type: 'function',
                id: callId,
              },
            ],
          },
        });
      } else {
        // Default text response
        responseMessage = new AIMessage({
          content:
            'I have analyzed the request. Here is the answer without tools.',
        });
      }

      const responseText =
        typeof responseMessage.content === 'string'
          ? responseMessage.content
          : '';

      // Simulate callbacks for tracing (CRITICAL for E2E tests relying on SSE)
      if (config?.callbacks) {
        try {
          const callbacks = Array.isArray(config.callbacks)
            ? config.callbacks
            : [config.callbacks];
          for (const callback of callbacks) {
            // 1. Start event
            if (callback.handleLLMStart) {
              await callback.handleLLMStart(
                { name: LLMModels.GEMINI_PRO_LATEST },
                [promptStr],
              );
            }

            // 2. Streaming tokens (if configured and we have text)
            if (callback.handleLLMNewToken && responseText) {
              const tokens = responseText.split(/(?=[ ])/g);
              for (const token of tokens) {
                await callback.handleLLMNewToken(token);
              }
            }

            // 3. End event
            if (callback.handleLLMEnd) {
              // Need to pass the actual generation result
              await callback.handleLLMEnd({
                generations: [
                  [{ message: responseMessage, text: responseText }],
                ],
              });
            }
          }
        } catch (err) {
          console.error('DEBUG MOCK CALLBACK ERROR:', err);
        }
      }

      return responseMessage;
    };

    // Return a mock object mimicking ChatGoogleGenerativeAI
    return {
      bindTools: (_tools: unknown[]) => {
        return {
          invoke: invokeWithCallbacks,
        };
      },
      invoke: invokeWithCallbacks,
    };
  },
};
