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
 * IMPORTANT: This is a temporary solution for extracting messages from traces.
 * See Chat_Message_Persistence.md for the enterprise-grade solution using
 * dedicated ConversationMessage entity.
 *
 * Current Strategy:
 * - User messages: Try to extract from observer/guardrail/reasoning node inputs
 * - AI responses: Extract from 'end' node's output.final_report
 * - Links AI messages to their corresponding reasoning traces
 *
 * Known Limitations:
 * - User messages may not be in traces (backend doesn't persist them reliably)
 * - Relies on optimistic UI updates for user messages
 * - Not suitable for long-term message persistence
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
    let sequence = 0;

    // Find traces that may contain user messages
    // Try observer, guardrail, and reasoning nodes (backend varies)
    const userMessageCandidates = traces
      .filter((t) => t.nodeName === 'observer' || t.nodeName === 'guardrail' || t.nodeName === 'reasoning')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Find end traces (always contain AI responses)
    const endTraces = traces
      .filter((t) => t.nodeName === 'end')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Try to extract user message from candidate traces
    // Note: Backend may not include user message in traces
    const userMessages: UserMessage[] = [];
    for (const candidate of userMessageCandidates) {
      const userMessage = this.extractUserMessageFromTrace(candidate);
      if (userMessage && !userMessages.some(um => um.content === userMessage.content)) {
        userMessage.sequence = sequence++;
        userMessages.push(userMessage);
        messages.push(userMessage);
        break; // Only one user message per execution
      }
    }

    // Extract AI responses
    endTraces.forEach((endTrace, index) => {
      // Get traces that belong to this execution
      const startIdx = index === 0 ? 0 : traces.indexOf(endTraces[index - 1]) + 1;
      const endIdx = traces.indexOf(endTrace) + 1;
      const executionTraces = traces.slice(startIdx, endIdx);
      
      const aiMessage = this.extractAIMessageFromTrace(endTrace, executionTraces);
      if (aiMessage) {
        aiMessage.sequence = sequence++;
        messages.push(aiMessage);
      }
    });

    // Sort by sequence for guaranteed ordering
    return messages.sort((a, b) => {
      if (a.sequence !== undefined && b.sequence !== undefined) {
        return a.sequence - b.sequence;
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Extract user's message from a trace (guardrail, observer, or reasoning node)
   * 
   * NOTE: This is a temporary solution until backend implements proper message persistence.
   * See Chat_Message_Persistence.md for enterprise-grade solution.
   */
  private extractUserMessageFromTrace(trace: ReasoningTrace): UserMessage | null {
    if (!trace?.input) {
      return null;
    }

    // Cast to any to access dynamic properties from backend
    const input = trace.input as any;
    
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
          id: `user-${trace.id}`,
          type: MessageType.USER,
          content: msg.kwargs.content,
          timestamp: trace.createdAt,
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
