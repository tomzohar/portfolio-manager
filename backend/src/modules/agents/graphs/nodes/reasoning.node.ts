import {
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { CIOState, StateUpdate } from '../types';
import { buildReasoningPrompt } from '../../prompts';
import { GeminiLlmService } from '../../services/gemini-llm.service';
import { ToolRegistryService } from '../../services/tool-registry.service';
import { getDefaultModel } from '../../utils/model.utils';
import { RunnableConfig } from '@langchain/core/runnables';

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
// Helper to initialize LLM
function initializeLLM(config: RunnableConfig): ChatGoogleGenerativeAI {
  const geminiService = config.configurable
    ?.geminiLlmService as GeminiLlmService;

  if (geminiService) {
    return geminiService.getChatModel({
      streaming: true,
      temperature: 0.2,
      maxOutputTokens: 2048,
    });
  }

  // Manual fallback
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: getDefaultModel(),
    temperature: 0.2,
    maxOutputTokens: 2048,
    streaming: true,
  });
}

/**
 * Sanitize messages for Google Gemini
 * Ensures all ToolMessages have a 'name' field, which is required by the API.
 * Infers name from preceding AIMessage tool calls if possible, or uses fallback.
 */
function sanitizeMessages(messages: BaseMessage[]): BaseMessage[] {
  const toolCallNames = new Map<string, string>();

  // First pass: Index tool calls from AIMessages to find names
  for (const msg of messages) {
    if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (tc.id) toolCallNames.set(tc.id, tc.name);
      }
    }
  }

  // Second pass: Fix ToolMessages missing names
  return messages.map((msg) => {
    if (msg instanceof ToolMessage && !msg.name) {
      const name = toolCallNames.get(msg.tool_call_id) || 'unknown_tool';
      return new ToolMessage({
        content: msg.content,
        tool_call_id: msg.tool_call_id,
        name: name,
        artifact: msg.artifact,
        status: msg.status,
      });
    }
    return msg;
  });
}

// Helper to construct history with sliding window
async function constructHistory(
  state: CIOState,
  tools: any[],
  geminiService: GeminiLlmService | undefined,
): Promise<BaseMessage[]> {
  // 1. Build System Message
  const systemPromptContent = buildReasoningPrompt(
    state.portfolio,
    state.userId,
    tools,
    state.threadId,
  );
  const systemMessage = new SystemMessage(systemPromptContent);

  // 2. Identify messages to include
  const allMessages = state.messages;
  const lastMessage = allMessages[allMessages.length - 1];

  // Helper to count tokens
  const count = async (msg: string | BaseMessage) => {
    const content =
      typeof msg === 'string'
        ? msg
        : typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);

    if (geminiService) {
      const metadata = await geminiService.countTokens(content);
      return metadata.totalTokens;
    }
    // Fallback estimation (char/4)
    return Math.ceil(content.length / 4);
  };

  let currentTokens = 0;
  const TOKEN_LIMIT = 20000;

  currentTokens += await count(systemPromptContent);
  currentTokens += await count(lastMessage);

  // 3. Select history messages (reverse chronological)
  const historyMessages: BaseMessage[] = [];

  // Iterate from second-to-last msg down to 0
  for (let i = allMessages.length - 2; i >= 0; i--) {
    const msg = allMessages[i];
    const tokens = await count(msg);

    if (currentTokens + tokens > TOKEN_LIMIT) {
      break;
    }

    currentTokens += tokens;
    historyMessages.unshift(msg);
  }

  return [systemMessage, ...historyMessages, lastMessage];
}

/**
 * Reasoning Node
 */
export async function reasoningNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  try {
    const bucketLLM = initializeLLM(config);
    const geminiService = config.configurable
      ?.geminiLlmService as GeminiLlmService;

    // Get tools
    const toolRegistry = config.configurable
      ?.toolRegistry as ToolRegistryService;
    const tools = toolRegistry?.getTools() || [];
    const llmWithTools =
      tools.length > 0 ? bucketLLM.bindTools(tools) : bucketLLM;

    // Construct prompt with history
    const rawMessages = await constructHistory(state, tools, geminiService);

    // Sanitize messages to ensure ToolMessages have names (required by Gemini)
    const finalMessages = sanitizeMessages(rawMessages);

    // Invoke LLM
    const response = await llmWithTools.invoke(finalMessages, {
      callbacks: config.callbacks,
    });

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
