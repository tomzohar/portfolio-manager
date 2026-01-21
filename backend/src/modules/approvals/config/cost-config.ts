/**
 * Cost Configuration
 *
 * Centralized configuration for cost and time estimation.
 * Used by CostEstimationService to calculate analysis costs.
 *
 * These values should be periodically reviewed and updated based on
 * actual API costs and measured execution times.
 */

/**
 * Tool execution costs (USD)
 */
export const TOOL_COSTS = {
  /** FRED API call cost */
  FRED: 0.01,

  /** Polygon API call cost */
  Polygon: 0.02,

  /** Financial Modeling Prep API call cost */
  FMP: 0.01,

  /** NewsAPI call cost */
  NewsAPI: 0.015,

  /** Default tool cost for unknown tools */
  DEFAULT: 0.01,
} as const;

/**
 * LLM execution costs (USD per 1K tokens)
 */
export const LLM_COSTS = {
  /** Cost per 1,000 tokens */
  PER_1K_TOKENS: 0.002,
} as const;

/**
 * Average token counts per node (based on historical data)
 */
export const NODE_TOKEN_AVERAGES = {
  /** Observer node (context gathering) */
  observer: 2000,

  /** Macro analysis node */
  macro_analysis: 5000,

  /** Technical analysis node */
  technical_analysis: 4000,

  /** Fundamental analysis node */
  fundamental_analysis: 6000,

  /** Risk analysis node */
  risk_analysis: 4500,

  /** Synthesis/reasoning node */
  reasoning: 7000,

  /** Performance attribution node */
  performance_attribution: 5500,

  /** Default node token count */
  default: 3000,
} as const;

/**
 * Execution time estimates (seconds)
 */
export const EXECUTION_TIME_ESTIMATES = {
  /** API call duration */
  API_CALL: 2,

  /** LLM call duration per node */
  LLM_PER_NODE: 10,

  /** Base overhead per node */
  NODE_OVERHEAD: 1,
} as const;
