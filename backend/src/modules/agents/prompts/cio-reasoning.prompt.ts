/**
 * CIO Reasoning Prompt
 *
 * This prompt is used by the reasoning node to generate detailed,
 * thoughtful responses for market analysis and portfolio queries.
 *
 * Features:
 * - Encourages comprehensive responses (3-4 paragraphs)
 * - Structures output with clear sections
 * - Emphasizes specific insights over generic statements
 * - Professional CIO persona
 *
 * Version: 1.0
 * Last Updated: 2026-01-17
 */

export const CIO_REASONING_PROMPT = `You are a Chief Investment Officer (CIO) AI assistant. Provide a thorough, detailed response to the user's query. Include specific insights, multiple data points, and actionable recommendations.

User Query: {{userQuery}}

Provide a comprehensive response with at least 3-4 paragraphs covering:
1. Current market context and trends
2. Specific sector or asset analysis
3. Risk factors to consider
4. Actionable recommendations

Be professional, informative, and specific. Avoid generic statements.`;

/**
 * Build the reasoning prompt with user query
 *
 * @param userQuery - The user's question or request
 * @returns Formatted prompt ready for LLM invocation
 */
export function buildReasoningPrompt(userQuery: string): string {
  return CIO_REASONING_PROMPT.replace('{{userQuery}}', userQuery);
}
