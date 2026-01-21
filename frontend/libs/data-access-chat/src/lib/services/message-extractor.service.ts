import { Injectable } from '@angular/core';
import {
  ReasoningTrace,
  ConversationMessage,
  UserMessage,
  AssistantMessage,
  MessageType,
} from '@stocks-researcher/types';

/**
 * MessageExtractorService
 *
 * Extracts conversation messages (user input + AI responses) from reasoning traces.
 *
 * Strategy:
 * - User messages: Extracted from 'observer' node's input.messages array
 * - AI responses: Extracted from 'end' node's output.final_report
 * - Links AI messages to their corresponding reasoning traces
 *
 * @example
 * ```typescript
 * const messages = this.extractor.extractMessagesFromTraces(traces);
 * // Returns: [UserMessage, AssistantMessage]
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class MessageExtractorService {
  /**
   * Extracts conversation messages from reasoning traces.
   *
   * @param traces - Array of reasoning traces from backend
   * @returns Array of conversation messages (user + assistant)
   */
  extractMessagesFromTraces(traces: ReasoningTrace[]): ConversationMessage[] {
    if (!traces || traces.length === 0) {
      return [];
    }

    const messages: ConversationMessage[] = [];

    // Extract user message from observer node
    const userMessage = this.extractUserMessage(traces);
    if (userMessage) {
      messages.push(userMessage);
    }

    // Extract AI response from end node
    const aiMessage = this.extractAIMessage(traces);
    if (aiMessage) {
      messages.push(aiMessage);
    }

    return messages;
  }

  /**
   * Extract user's message from observer node
   */
  private extractUserMessage(traces: ReasoningTrace[]): UserMessage | null {
    const observerTrace = traces.find((t) => t.nodeName === 'observer');

    if (!observerTrace?.input) {
      return null;
    }

    // Cast to any to access dynamic properties from backend
    const input = observerTrace.input as any;
    
    if (!input.messages || !Array.isArray(input.messages)) {
      return null;
    }

    // Find the user's message (HumanMessage in LangChain format)
    const messages = input.messages;

    // Get the last user message (most recent)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.kwargs?.content && typeof msg.kwargs.content === 'string') {
        return {
          id: `user-${observerTrace.id}`,
          type: MessageType.USER,
          content: msg.kwargs.content,
          timestamp: observerTrace.createdAt,
        };
      }
    }

    return null;
  }

  /**
   * Extract AI's response from end node
   */
  private extractAIMessage(traces: ReasoningTrace[]): AssistantMessage | null {
    const endTrace = traces.find((t) => t.nodeName === 'end');
    
    if (!endTrace?.output) {
      return null;
    }

    // Cast output to any to access dynamic properties
    const output = endTrace.output as any;
    
    if (!output.final_report || typeof output.final_report !== 'string') {
      return null;
    }

    return {
      id: `ai-${endTrace.id}`,
      type: MessageType.ASSISTANT,
      content: output.final_report,
      timestamp: endTrace.createdAt,
      traceIds: traces.map((t) => t.id), // Link to all traces for this execution
    };
  }
}
