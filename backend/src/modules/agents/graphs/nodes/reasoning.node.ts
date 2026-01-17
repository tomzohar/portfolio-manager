import { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { CIOState, StateUpdate } from '../types';
import { buildReasoningPrompt } from '../../prompts';

/**
 * Reasoning Node
 *
 * Uses an LLM with streaming enabled to generate a thoughtful response
 * to the user's query. This node demonstrates token-level streaming via
 * the TracingCallbackHandler.
 *
 * Key Features:
 * - Streaming enabled ({ streaming: true })
 * - Callbacks automatically invoke handleLLMNewToken for each token
 * - SSE endpoint receives real-time token events
 */
export async function reasoningNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  try {
    // Get the API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        errors: ['GEMINI_API_KEY not configured'],
        messages: [
          new AIMessage(
            'Sorry, I cannot generate a response at this time due to missing configuration.',
          ),
        ],
      };
    }

    // Initialize LLM with streaming enabled
    const llm = new ChatGoogleGenerativeAI({
      apiKey,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
      temperature: 0.5,
      maxOutputTokens: 2048, // Increased for longer responses
      streaming: true, // CRITICAL: Enables token-by-token streaming
    });

    // Get the last user message
    const lastMessage = state.messages[state.messages.length - 1];
    const userQuery =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    // Build prompt using external prompt template
    const prompt = buildReasoningPrompt(userQuery);

    // Invoke LLM with streaming
    // The config.callbacks from OrchestratorService will automatically handle token events
    const response = await llm.invoke(prompt, {
      callbacks: config.callbacks, // Pass through callbacks for tracing
    });

    const responseText =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    return {
      messages: [new AIMessage(responseText)],
      iteration: state.iteration + 1,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      errors: [errorMessage],
      messages: [
        new AIMessage(
          'Sorry, I encountered an error while processing your request.',
        ),
      ],
    };
  }
}
