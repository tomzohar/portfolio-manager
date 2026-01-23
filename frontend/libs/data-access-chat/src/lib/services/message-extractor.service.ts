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

    // Find ALL observer traces (user messages)
    const observerTraces = traces.filter((t) => t.nodeName === 'observer');
    
    // Find ALL end traces (AI responses)
    const endTraces = traces.filter((t) => t.nodeName === 'end');

    // Sort by timestamp to maintain chronological order
    observerTraces.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    endTraces.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Extract all user messages
    observerTraces.forEach((observerTrace) => {
      const userMessage = this.extractUserMessageFromTrace(observerTrace);
      if (userMessage) {
        messages.push(userMessage);
      }
    });

    // Extract all AI responses with their associated trace IDs
    endTraces.forEach((endTrace, index) => {
      // Get traces that belong to this execution
      // Traces between previous end and current end belong to this execution
      const startIdx = index === 0 ? 0 : traces.indexOf(endTraces[index - 1]) + 1;
      const endIdx = traces.indexOf(endTrace) + 1;
      const executionTraces = traces.slice(startIdx, endIdx);
      
      const aiMessage = this.extractAIMessageFromTrace(endTrace, executionTraces);
      if (aiMessage) {
        messages.push(aiMessage);
      }
    });

    // Sort final messages by timestamp to maintain conversation order
    return messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Extract user's message from a single observer trace
   */
  private extractUserMessageFromTrace(observerTrace: ReasoningTrace): UserMessage | null {
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
   * Extract AI's response from a single end trace
   * 
   * @param endTrace - The end trace containing the final report
   * @param executionTraces - All traces from this specific execution (for linking)
   */
  private extractAIMessageFromTrace(
    endTrace: ReasoningTrace,
    executionTraces: ReasoningTrace[]
  ): AssistantMessage | null {
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
      traceIds: executionTraces.map((t) => t.id), // Link to traces for this execution
    };
  }
}
