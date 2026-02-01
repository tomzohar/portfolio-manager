import {
  AIMessage,
  BaseMessage,
  ToolMessage,
  SystemMessage,
} from '@langchain/core/messages';

interface MessageWithKwargs extends BaseMessage {
  kwargs?: {
    tool_calls?: ToolCallStructure[];
  };
}

interface OpenAIToolCall {
  id: string;
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

interface GeminiContentPart {
  type: string;
  functionCall?: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
  };
}

/**
 * Standardized tool call structure used internally
 */
export type ToolCallStructure = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  type?: 'tool_call';
};

/**
 * Type-safe check for AIMessage (handles both class instances and POJOs from checkpoints)
 */
export function isAIMessage(msg: unknown): msg is AIMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as {
    _getType?: () => string;
    getType?: () => string;
    type?: string;
    constructor?: { name: string };
  };

  return (
    msg instanceof AIMessage ||
    m._getType?.() === 'ai' ||
    m.getType?.() === 'ai' ||
    m.type === 'ai' ||
    m.constructor?.name === 'AIMessage'
  );
}

/**
 * Type-safe check for ToolMessage
 */
export function isToolMessage(msg: unknown): msg is ToolMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as {
    _getType?: () => string;
    getType?: () => string;
    type?: string;
    constructor?: { name: string };
  };

  return (
    msg instanceof ToolMessage ||
    m._getType?.() === 'tool' ||
    m.getType?.() === 'tool' ||
    m.type === 'tool' ||
    m.constructor?.name === 'ToolMessage'
  );
}

/**
 * Type-safe check for SystemMessage
 */
export function isSystemMessage(msg: unknown): msg is SystemMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as {
    _getType?: () => string;
    getType?: () => string;
    type?: string;
    constructor?: { name: string };
  };

  return (
    msg instanceof SystemMessage ||
    m._getType?.() === 'system' ||
    m.getType?.() === 'system' ||
    m.type === 'system' ||
    m.constructor?.name === 'SystemMessage'
  );
}

/**
 * Extract tool calls from message using all available formats
 */
export function extractToolCalls(
  message: BaseMessage | undefined,
): ToolCallStructure[] {
  if (!message || !isAIMessage(message)) {
    return [];
  }

  // 1. Try standard property first
  if (message.tool_calls && message.tool_calls.length > 0) {
    return message.tool_calls as ToolCallStructure[];
  }

  // 2. Try kwargs (checkpointed messages)
  const kwargs = (message as unknown as MessageWithKwargs).kwargs;
  if (kwargs?.tool_calls && kwargs.tool_calls.length > 0) {
    return kwargs.tool_calls;
  }

  // 3. Try additional_kwargs (OpenAI format)
  if (message.additional_kwargs?.tool_calls) {
    const rawToolCalls = message.additional_kwargs
      .tool_calls as unknown as OpenAIToolCall[];
    return rawToolCalls.map((raw) => {
      try {
        return {
          id: raw.id,
          name: raw.function.name,
          args:
            typeof raw.function.arguments === 'string'
              ? (JSON.parse(raw.function.arguments) as Record<string, unknown>)
              : raw.function.arguments,
          type: 'tool_call' as const,
        };
      } catch {
        return {
          id: raw.id,
          name: raw.function.name,
          args: { __parse_error: 'Invalid JSON in arguments' },
          type: 'tool_call' as const,
        };
      }
    });
  }

  // 4. Try Gemini content array format
  if (Array.isArray(message.content)) {
    const toolCalls: ToolCallStructure[] = [];
    const parts = message.content as unknown as GeminiContentPart[];
    for (const part of parts) {
      if (
        part.functionCall &&
        part.functionCall.name &&
        part.functionCall.args
      ) {
        toolCalls.push({
          id:
            part.functionCall.id ||
            `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          args: part.functionCall.args,
          type: 'tool_call' as const,
        });
      }
    }
    if (toolCalls.length > 0) return toolCalls;
  }

  return [];
}

/**
 * Ensures an AIMessage has the 'tool_calls' property populated and is a class instance.
 */
export function normalizeAIMessage(message: BaseMessage): BaseMessage {
  if (!isAIMessage(message)) return message;

  const toolCalls = extractToolCalls(message);

  // Always return a fresh AIMessage instance to ensure it has all methods
  return new AIMessage({
    content: message.content,
    additional_kwargs: { ...message.additional_kwargs },
    response_metadata: { ...message.response_metadata },
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    id: message.id,
  });
}
