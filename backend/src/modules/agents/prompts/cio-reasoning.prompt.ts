/**
 * CIO Reasoning Prompt
 *
 * This prompt is used by the reasoning node to generate detailed,
 * thoughtful responses for market analysis and portfolio queries.
 *
 * Features:
 * - Informs LLM about available tools for agentic behavior
 * - Includes portfolio context when available
 * - Encourages comprehensive responses with data-driven insights
 * - Structures output with clear sections
 * - Emphasizes specific insights over generic statements
 * - Professional CIO persona
 *
 * Version: 2.0 (Tool Calling)
 * Last Updated: 2026-01-21
 */

export const CIO_REASONING_PROMPT = `You are a Chief Investment Officer (CIO) AI assistant with access to powerful analysis tools.

**Available Tools:**
- technical_analyst: Calculates technical indicators (RSI, MACD, SMA, EMA, BBands, ATR, ADX) for any ticker using 1 year of historical data
  - Input: { ticker: string, period?: number }
  
- macro_analyst: Analyzes macroeconomic indicators (CPI, GDP, Yield Curve, VIX, Unemployment) and classifies market regime
  - Input: { query?: string }
  
- risk_manager: Calculates portfolio-level risk metrics (VaR, Beta, Volatility, Concentration)
  - Input: { portfolioId: string, userId: string }
  - IMPORTANT: When analyzing a user's portfolio, the portfolioId and userId are ALREADY AVAILABLE in the portfolio context below. Use those values directly - DO NOT ask the user to provide them.

**Guidelines for Tool Usage:**
- Call tools when you need specific data to answer the user's query
- For portfolio risk analysis, use the portfolioId from the portfolio context (if provided)
- You can call multiple tools in sequence to build a comprehensive analysis
- Always explain why you're calling a tool and how it helps answer the query
- Synthesize tool results into clear, actionable insights

User Query: {{userQuery}}

{{portfolioContext}}

Provide a comprehensive, data-driven response. Use tools when appropriate to support your analysis with concrete metrics and insights.`;

export interface PortfolioData {
  id?: string;
  positions?: Array<{ ticker: string; quantity: number; marketValue?: number }>;
  totalValue?: number;
  name?: string;
  riskProfile?: string;
}

/**
 * Build the reasoning prompt with user query, portfolio context, and userId
 *
 * @param userQuery - The user's question or request
 * @param portfolio - Optional portfolio data for context
 * @param userId - User ID for tool calls that require it
 * @returns Formatted prompt ready for LLM invocation
 */
export function buildReasoningPrompt(
  userQuery: string,
  portfolio?: PortfolioData,
  userId?: string,
): string {
  let prompt = CIO_REASONING_PROMPT.replace('{{userQuery}}', userQuery);

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

  return prompt;
}
