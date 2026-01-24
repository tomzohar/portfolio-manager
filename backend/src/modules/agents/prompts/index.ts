/**
 * Agent Prompts Index
 *
 * Central export file for all agent prompts and related utilities.
 * This makes it easy to import prompts throughout the application
 * and maintain consistent prompt management.
 *
 * Usage:
 * ```typescript
 * import { buildReasoningPrompt, formatToolsSection } from '../prompts';
 * const prompt = buildReasoningPrompt(userQuery, portfolio, userId, tools);
 * const toolsText = formatToolsSection(tools);
 * ```
 */

export {
  CIO_REASONING_PROMPT,
  buildReasoningPrompt,
} from './cio-reasoning.prompt';

export { formatTool, formatToolsSection } from './tool-formatter.util';
