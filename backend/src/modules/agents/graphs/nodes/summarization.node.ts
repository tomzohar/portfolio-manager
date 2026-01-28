import { SystemMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { GeminiLlmService } from '../../services/gemini-llm.service';
import { CIOState, StateUpdate } from '../types';

/**
 * Summarization Node
 *
 * Compresses conversation history when it exceeds token limits.
 * Uses Gemini Flash (if configured) or standard model to summarize oldest messages.
 *
 * Logic:
 * 1. Count total tokens in state.messages
 * 2. If > Threshold (e.g. 30k), identify oldest 50% chunk
 * 3. Summarize chunk into a single SystemMessage
 * 4. Replace chunk with summary + "Previous Context: " marker
 */

export async function summarizationNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  try {
    const geminiService = config.configurable
      ?.geminiLlmService as GeminiLlmService;
    if (!geminiService) {
      return {};
    }

    const SUMMARY_THRESHOLD = 30000;

    // 1. Calculate total tokens
    const messages = state.messages;
    let totalTokens = 0;
    for (const msg of messages) {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      let tokens = 0;
      // Safety check: ensure countTokens exists (fix for E2E tests where it might vary)
      if (typeof geminiService.countTokens === 'function') {
        const meta = await geminiService.countTokens(content);
        tokens = meta.totalTokens;
      } else {
        // Fallback estimation: ~4 chars per token
        tokens = Math.ceil(content.length / 4);
      }
      totalTokens += tokens;
    }

    if (totalTokens < SUMMARY_THRESHOLD) {
      return {};
    }

    // 2. Identify chunk to summarize
    const RECENT_KEEP_COUNT = 10;
    if (messages.length <= RECENT_KEEP_COUNT + 1) {
      return {};
    }

    const messagesToSummarize = messages.slice(0, -RECENT_KEEP_COUNT);

    // 3. Generate Structured Summary
    const llm = geminiService.getChatModel({
      temperature: 0.1,
      maxOutputTokens: 1024,
    });

    // Define structured output schema
    const SummarySchema = z.object({
      summary: z
        .string()
        .describe('Concise narrative summary of the conversation'),
      key_decisions: z
        .array(z.string())
        .describe('List of key decisions or facts'),
    });

    const structuredLlm = llm.withStructuredOutput(SummarySchema);

    const conversationText = messagesToSummarize
      .map((m) => {
        const role = m._getType();
        const content =
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return `${role.toUpperCase()}: ${content}`;
      })
      .join('\n');

    const summaryPrompt = `
    Summarize the following conversation history.
    Focus on key facts, user preferences, and decisions made.
    
    Conversation:
    ${conversationText}
    `;

    const response = await structuredLlm.invoke(summaryPrompt);

    // Format the summary for the SystemMessage
    const formattedSummary = `
PREVIOUS CONVERSATION SUMMARY:
${response.summary}

KEY FACTS/DECISIONS:
${response.key_decisions.join('\n- ')}
`;

    const summaryMessage = new SystemMessage(formattedSummary.trim());

    return {
      messages: [summaryMessage],
    };
  } catch (error) {
    console.error('Summarization failed', error);
    return {};
  }
}
