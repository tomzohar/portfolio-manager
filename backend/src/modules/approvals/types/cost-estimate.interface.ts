/**
 * CostEstimate Interface
 *
 * Represents the estimated cost and time for an analysis plan.
 * Used in HITL approval gates to inform users before expensive operations.
 */

/**
 * Cost breakdown for a single node or operation
 */
export interface CostBreakdownItem {
  /** Name of the node or operation */
  nodeName: string;

  /** Estimated cost in USD */
  costUSD: number;

  /** Estimated execution time in seconds */
  timeSeconds: number;
}

/**
 * Complete cost estimate for an analysis plan
 */
export interface CostEstimate {
  /** Total cost in USD */
  totalCostUSD: number;

  /** Total estimated time in seconds */
  estimatedTimeSeconds: number;

  /** Breakdown by node/operation */
  breakdown: CostBreakdownItem[];
}

/**
 * Analysis plan structure
 */
export interface AnalysisPlan {
  /** List of nodes that will be executed */
  nodes?: string[];

  /** List of tools that will be called */
  tools?: string[];

  /** Additional metadata */
  [key: string]: unknown;
}
