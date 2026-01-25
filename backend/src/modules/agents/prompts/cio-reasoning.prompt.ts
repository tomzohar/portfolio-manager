/**
 * CIO Reasoning Prompt
 *
 * This prompt is used by the reasoning node to generate detailed,
 * thoughtful responses for market analysis and portfolio queries.
 *
 * Features:
 * - Informs LLM about available tools for agentic behavior
 * - Dynamically generates tool descriptions from tool metadata
 * - Includes portfolio context when available
 * - Encourages comprehensive responses with data-driven insights
 * - Structures output with clear sections
 * - Emphasizes specific insights over generic statements
 * - Professional CIO persona
 *
 * Version: 3.0 (Dynamic Tool Formatting)
 * Last Updated: 2026-01-23
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { formatToolsSection } from './tool-formatter.util';

export const CIO_REASONING_PROMPT = `You are a Chief Investment Officer (CIO) assistant.

RESPONSE STRATEGY - Follow Strictly:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. GREETINGS (hi, hello, hey, good morning, how are you)
   ✓ Respond warmly in 1-2 sentences
   ✗ DO NOT call any tools
   
   Examples:
   User: "Hello"
   You: "Hello! I'm your CIO assistant. I can analyze stocks, assess market conditions, and help with portfolio decisions. What would you like to explore?"
   [NO TOOLS]
   
   User: "Hi there!"  
   You: "Hi! Ready to help with market analysis and investment insights. What's on your mind?"
   [NO TOOLS]

2. CAPABILITY QUESTIONS (what can you do, help, capabilities)
   ✓ Describe capabilities briefly
   ✗ DO NOT call any tools
   
   Example:
   User: "What can you do?"
   You: "I help with:
   • Stock analysis (technical indicators, trends)
   • Market outlook (economic regime, risk sentiment)
   • Portfolio risk assessment
   Just ask me to analyze a ticker or check market conditions!"
   [NO TOOLS]

3. FOLLOW-UP QUESTIONS
   ✓ Reuse previous tool results if in conversation
   ✗ Only call tools for NEW data
   
4. ANALYSIS REQUESTS (analyze [ticker], market outlook, portfolio review)
   ✓ Call tools to gather data
   ✓ Be Conversational, not formal reports
   
   Example:
   User: "Analyze AAPL"
   You: [CALLS technical_analyst(ticker="AAPL")]
   You: "Looking at Apple... AAPL is at $250.92, below its 50-day average. RSI at 29 suggests oversold - potential buying opportunity. Want fundamentals too?"
   [CONVERSATIONAL, not **Executive Summary**]

{{tools}}

**Tone**: Conversational and approachable, like a smart colleague

User Query: {{userQuery}}
{{portfolioContext}}
`;

export interface PortfolioData {
  id?: string;
  positions?: Array<{ ticker: string; quantity: number; marketValue?: number }>;
  totalValue?: number;
  name?: string;
  riskProfile?: string;
}

/**
 * Build the reasoning (system) prompt with portfolio context, userId, and tools
 *
 * @param portfolio - Optional portfolio data for context
 * @param userId - User ID for tool calls that require it
 * @param tools - Optional array of tools to dynamically format
 * @returns Formatted system prompt ready for LLM invocation
 */
export function buildReasoningPrompt(
  portfolio?: PortfolioData,
  userId?: string,
  tools?: DynamicStructuredTool[],
  threadId?: string,
): string {
  // Remove {{userQuery}} placeholder from base prompt as it is now passed as a message
  let prompt = CIO_REASONING_PROMPT.replace(
    'User Query: {{userQuery}}',
    '',
  ).trim();

  // Add dynamically formatted tools section
  if (tools) {
    const toolsSection = formatToolsSection(tools);
    prompt = prompt.replace('{{tools}}', toolsSection);
  } else {
    // Fallback to hardcoded tools for backward compatibility
    const hardcodedTools = `**Available Tools:**
- technical_analyst(ticker): Technical indicators, price trends
- macro_analyst(): Market regime, economic conditions
- risk_manager(portfolioId, userId): Portfolio risk metrics
  - IMPORTANT: When analyzing a user's portfolio, the portfolioId and userId are ALREADY AVAILABLE in the portfolio context below. Use those values directly - DO NOT ask the user to provide them.`;
    prompt = prompt.replace('{{tools}}', hardcodedTools);
  }

  // Add portfolio context if available
  if (portfolio) {
    const tickers = portfolio.positions?.map((p) => p.ticker).join(', ') || '';
    const portfolioInfo = `
**Portfolio Context:**
- Portfolio ID: ${portfolio.id || 'N/A'}
- User ID: ${userId || 'N/A'}
- Name: ${portfolio.name || 'Unnamed Portfolio'}
- Risk Profile: ${portfolio.riskProfile || 'N/A'}
- Total Value: $${portfolio.totalValue?.toLocaleString() || 'N/A'}
- Holdings: ${tickers || 'N/A'}

**IMPORTANT for risk_manager tool:** Use portfolioId="${portfolio.id}" and userId="${userId}" when calling the risk_manager tool. These values are provided above - do NOT ask the user for them.
`;
    prompt = prompt.replace('{{portfolioContext}}', portfolioInfo);
  } else {
    prompt = prompt.replace('{{portfolioContext}}', '');
  }

  // Add search_history context
  const searchContext = `
**IMPORTANT for search_history tool:** Use userId="${userId}" and threadId="${threadId}" when calling the search_history tool. These values are provided here - do NOT ask the user for them.
`;
  prompt += searchContext;

  return prompt;
}
