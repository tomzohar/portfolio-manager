import { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { CIOState, StateUpdate } from '../types';
import { buildReasoningPrompt } from '../../prompts';
import { GeminiLlmService } from '../../services/gemini-llm.service';
import { ToolRegistryService } from '../../services/tool-registry.service';

/**
 * Reasoning Node
 *
 * Uses an LLM with streaming and tool calling enabled to generate thoughtful
 * responses to user queries. The LLM can autonomously call tools (technical_analyst,
 * macro_analyst, risk_manager) to gather data before responding.
 *
 * Key Features:
 * - Streaming enabled ({ streaming: true })
 * - Tool calling via bindTools() for agentic behavior
 * - Callbacks automatically invoke handleLLMNewToken for each token
 * - SSE endpoint receives real-time token events
 * - Returns AIMessage with potential tool_calls in additional_kwargs
 */
export async function reasoningNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  try {
    // Get the API key from environment
    // Check for injected service (e.g. for testing)

    const geminiService = config.configurable
      ?.geminiLlmService as GeminiLlmService;

    let llm: ChatGoogleGenerativeAI;

    if (geminiService) {
      // Use the injected service to get the model
      llm = geminiService.getChatModel({
        streaming: true,
        temperature: 0.2,
        maxOutputTokens: 2048,
      });
    } else {
      // Fallback to manual instantiation if service not provided
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
      llm = new ChatGoogleGenerativeAI({
        apiKey,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
        temperature: 0.2, // Lower temperature for more deterministic behavior (greetings, help queries)
        maxOutputTokens: 2048, // Increased for longer responses
        streaming: true, // CRITICAL: Enables token-by-token streaming
      });
    }

    // Get tools from registry (passed via config)
    const toolRegistry = config.configurable
      ?.toolRegistry as ToolRegistryService;
    const tools = toolRegistry?.getTools() || [];

    // Bind tools to LLM for agentic tool calling
    const llmWithTools = tools.length > 0 ? llm.bindTools(tools) : llm;

    // Get the last user message
    const lastMessage = state.messages[state.messages.length - 1];
    const userQuery =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    // Build prompt using external prompt template
    // Includes portfolio context, userId, and dynamically formatted tools
    const prompt = buildReasoningPrompt(
      userQuery,
      state.portfolio,
      state.userId,
      tools, // Pass tools for dynamic formatting
    );

    // Invoke LLM with streaming and tools
    // The config.callbacks from OrchestratorService will automatically handle token events

    const response = await llmWithTools.invoke(prompt, {
      callbacks: config.callbacks, // Pass through callbacks for tracing
    });

    // Return AIMessage as-is to preserve tool_calls in additional_kwargs
    return {
      messages: [response],
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
