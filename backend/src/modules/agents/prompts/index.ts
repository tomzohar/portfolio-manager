/**
 * Agent Prompts Index
 *
 * Central export file for all agent prompts.
 * This makes it easy to import prompts throughout the application
 * and maintain consistent prompt management.
 *
 * Usage:
 * ```typescript
 * import { buildReasoningPrompt } from '../prompts';
 * const prompt = buildReasoningPrompt(userQuery);
 * ```
 */

export {
  CIO_REASONING_PROMPT,
  buildReasoningPrompt,
} from './cio-reasoning.prompt';
