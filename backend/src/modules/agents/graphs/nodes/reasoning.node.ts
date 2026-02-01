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
import {
  extractToolCalls,
  normalizeAIMessage,
  isAIMessage,
  isToolMessage,
  isSystemMessage,
} from '../../utils/message.utils';

/**
 * Reasoning Node
 */

function initializeLLM(config: RunnableConfig): ChatGoogleGenerativeAI {
  const geminiService = config.configurable
    ?.geminiLlmService as GeminiLlmService;

  if (geminiService) {
    return geminiService.getChatModel({
      streaming: true,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: getDefaultModel(),
    temperature: 0.2,
    maxOutputTokens: 8192,
    streaming: true,
  });
}

/**
 * Normalize and sanitize messages for Google Gemini
 */
function normalizeMessages(messages: BaseMessage[]): BaseMessage[] {
  const toolCallNames = new Map<string, string>();

  // First pass: Index tool calls to find names for ToolMessages
  for (const msg of messages) {
    if (isAIMessage(msg)) {
      const toolCalls = extractToolCalls(msg);
      for (const tc of toolCalls) {
        if (tc.id) toolCallNames.set(tc.id, tc.name);
      }
    }
  }

  return messages.map((msg) => {
    if (isAIMessage(msg)) {
      return normalizeAIMessage(msg);
    }

    if (isToolMessage(msg) && !msg.name) {
      const toolMsg = msg as unknown as {
        artifact?: any;
        status?: 'success' | 'error';
      };
      const name = toolCallNames.get(msg.tool_call_id) || 'unknown_tool';
      return new ToolMessage({
        content: msg.content,
        tool_call_id: msg.tool_call_id,
        name: name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        artifact: toolMsg.artifact,
        status: toolMsg.status,
      });
    }

    return msg;
  });
}

// Helper to construct history with sliding window and protocol safety
async function constructHistory(
  state: CIOState,
  tools: any[],
  geminiService: GeminiLlmService | undefined,
): Promise<BaseMessage[]> {
  const allMessages = state.messages;

  // 1. Collect and filter out SystemMessages from history
  const historySystemContent: string[] = [];
  const cleanMessages: BaseMessage[] = [];

  for (const msg of allMessages) {
    if (isSystemMessage(msg)) {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      if (content.trim()) historySystemContent.push(content);
    } else {
      cleanMessages.push(msg);
    }
  }

  // 2. Build the main Session System Message
  let sessionPrompt = buildReasoningPrompt(
    state.portfolio,
    state.userId,
    tools,
    state.threadId,
  );

  if (historySystemContent.length > 0) {
    sessionPrompt +=
      '\n\nAdditional Context from History:\n' +
      historySystemContent.join('\n\n');
  }

  const mainSystemMessage = new SystemMessage(sessionPrompt);

  // 3. Helper to count tokens
  const count = async (msg: string | BaseMessage) => {
    const content =
      typeof msg === 'string'
        ? msg
        : typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);

    if (geminiService && typeof geminiService.countTokens === 'function') {
      const metadata = await geminiService.countTokens(content);
      return metadata.totalTokens;
    }
    return Math.ceil(content.length / 4);
  };

  let currentTokens = await count(sessionPrompt);
  const TOKEN_LIMIT = 20000;

  // 4. Select history messages from cleanMessages (reverse chronological)
  // We must be careful not to bifurcate tool call/response sequences
  const resultMessages: BaseMessage[] = [];

  if (cleanMessages.length > 0) {
    const lastMsg = cleanMessages[cleanMessages.length - 1];
    currentTokens += await count(lastMsg);
    resultMessages.unshift(lastMsg);

    let i = cleanMessages.length - 2;
    while (i >= 0) {
      const msg = cleanMessages[i];
      const group: BaseMessage[] = [msg];
      let j = i - 1;

      // Group tool messages with their preceding AIMessage
      if (isToolMessage(msg)) {
        while (
          j >= 0 &&
          (isToolMessage(cleanMessages[j]) || isAIMessage(cleanMessages[j]))
        ) {
          group.unshift(cleanMessages[j]);
          if (isAIMessage(cleanMessages[j])) {
            j--;
            break;
          }
          j--;
        }
      }

      let groupTokens = 0;
      for (const groupMsg of group) groupTokens += await count(groupMsg);

      if (currentTokens + groupTokens > TOKEN_LIMIT) break;

      currentTokens += groupTokens;
      resultMessages.unshift(...group);
      i = j;
    }
  }

  return [mainSystemMessage, ...resultMessages];
}

export async function reasoningNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  try {
    const bucketLLM = initializeLLM(config);
    const geminiService = config.configurable
      ?.geminiLlmService as GeminiLlmService;

    const toolRegistry = config.configurable
      ?.toolRegistry as ToolRegistryService;
    const tools = toolRegistry?.getTools() || [];
    const llmWithTools =
      tools.length > 0 ? bucketLLM.bindTools(tools) : bucketLLM;

    // 1. Construct prompt and atomic history
    const rawMessages = await constructHistory(state, tools, geminiService);

    // 2. Normalize for Gemini protocol (restore tool_calls, ensure names)
    const finalMessages = normalizeMessages(rawMessages);

    // 3. Last stand safety check: if we somehow ended with an AIMessage that has tool calls
    // but no responses, Gemini will fail. We should ideally never reach this with our grouping logic.
    const lastMsg = finalMessages[finalMessages.length - 1];
    if (isAIMessage(lastMsg)) {
      const toolCalls = extractToolCalls(lastMsg);
      if (toolCalls.length > 0) {
        console.warn(
          '[ReasoningNode] Detected AIMessage with unresponded tool calls at history end. Trimming.',
        );
        finalMessages.pop();
      }
    }

    // Invoke LLM
    const response = await llmWithTools.invoke(finalMessages, {
      callbacks: config.callbacks,
    });

    return {
      messages: [response],
    };
  } catch (error) {
    console.error('DEBUG: Reasoning Node Error:', error);
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
