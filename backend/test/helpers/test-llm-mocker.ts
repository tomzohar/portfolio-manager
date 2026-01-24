import { AIMessage } from '@langchain/core/messages';
import { GeminiResponse, GeminiUsageMetadata } from '../../src/modules/agents/services/gemini-llm.service';

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
    generateContent: async (prompt: string, model?: string): Promise<GeminiResponse> => {
        return {
            text: 'Mock LLM response for testing.',
            usage: {
                promptTokens: 10,
                completionTokens: 5,
                totalTokens: 15
            } as GeminiUsageMetadata
        };
    },

    // NEW: Mock ChatModel for LangGraph
    getChatModel: (options: any) => {
        // Shared invoke logic to trigger callbacks
        const invokeWithCallbacks = async (input: any, config?: any) => {
            let promptStr = '';

            if (Array.isArray(input)) {
                // Extract prompt from all messages
                promptStr = input.map(m => {
                    if (typeof m.content === 'string') return m.content;
                    if (Array.isArray(m.content)) return m.content.map((c: any) => c.text || '').join(' ');
                    return JSON.stringify(m.content);
                }).join('\n');
            } else if (input && input.content) {
                promptStr = typeof input.content === 'string' ? input.content : JSON.stringify(input.content);
            } else {
                promptStr = JSON.stringify(input);
            }

            const prompt = promptStr.toLowerCase();

            // Check for tool outputs in the prompt history to detect if tool has already run
            // We check for MULTIPLE unique fields to ensure it's not just the system prompt description
            const hasTechnicalAnalysis = prompt.includes('sma_50') && prompt.includes('current_price');
            const hasMacroAnalysis = prompt.includes('gdp_growth') && prompt.includes('inflation_rate');

            if (hasTechnicalAnalysis || hasMacroAnalysis) {
                const finalResponse = new AIMessage({
                    content: "I have analyzed the data from the tool. Here is the final answer.",
                });

                // Trigger callbacks for the final answer
                if (config?.callbacks) {
                    try {
                        for (const callback of config.callbacks) {
                            if (callback.handleLLMStart) await callback.handleLLMStart({ name: 'gemini-pro' }, [promptStr]);
                            if (callback.handleLLMNewToken) {
                                await callback.handleLLMNewToken("I have ");
                                await callback.handleLLMNewToken("analyzed ");
                                await callback.handleLLMNewToken("the data.");
                            }
                            if (callback.handleLLMEnd) await callback.handleLLMEnd({ generations: [[{ message: finalResponse, text: finalResponse.content as string }]] });
                        }
                    } catch (e) { console.error('Callback error', e); }
                }
                return finalResponse;
            }

            let responseMessage: any;

            // Conditional logic to trigger tools based on prompt keywords
            if (prompt.includes('analyze aapl') || prompt.includes('analyze tsla')) {
                const ticker = prompt.includes('aapl') ? 'AAPL' : 'TSLA';
                const callId = `call_${Date.now()}`;

                responseMessage = new AIMessage({
                    content: "",
                    tool_calls: [{
                        name: 'technical_analyst',
                        args: { ticker: ticker },
                        id: callId
                    }],
                    additional_kwargs: {
                        tool_calls: [{
                            function: {
                                name: 'technical_analyst',
                                arguments: JSON.stringify({ ticker: ticker })
                            },
                            type: 'function',
                            id: callId
                        }]
                    }
                });

                // FORCE explicit assignment to ensure property exists
                responseMessage.tool_calls = [{
                    name: 'technical_analyst',
                    args: { ticker: ticker },
                    id: callId
                }];

            } else if (prompt.includes('market outlook') || prompt.includes('macro')) {
                const callId = `call_${Date.now()}`;
                responseMessage = new AIMessage({
                    content: "",
                    tool_calls: [{
                        name: 'macro_analyst',
                        args: {},
                        id: callId
                    }],
                    additional_kwargs: {
                        tool_calls: [{
                            function: {
                                name: 'macro_analyst',
                                arguments: "{}"
                            },
                            type: 'function',
                            id: callId
                        }]
                    }
                });

                // FORCE explicit assignment
                responseMessage.tool_calls = [{
                    name: 'macro_analyst',
                    args: {},
                    id: callId
                }];

            } else {
                // Default text response
                responseMessage = new AIMessage({
                    content: "I have analyzed the request. Here is the answer without tools.",
                });
            }

            const responseText = typeof responseMessage.content === 'string' ? responseMessage.content : '';

            // Simulate callbacks for tracing (CRITICAL for E2E tests relying on SSE)
            if (config?.callbacks) {
                try {
                    for (const callback of config.callbacks) {
                        // 1. Start event
                        if (callback.handleLLMStart) {
                            await callback.handleLLMStart({ name: 'gemini-pro' }, [promptStr]);
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
                            await callback.handleLLMEnd({ generations: [[{ message: responseMessage, text: responseText }]] });
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
            bindTools: (tools: any[]) => {
                return {
                    invoke: invokeWithCallbacks
                };
            },
            invoke: invokeWithCallbacks
        };
    }
};
