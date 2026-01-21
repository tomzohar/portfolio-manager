/**
 * ToolResult Interface
 *
 * Defines the structure for results from external tool executions.
 * Used in reasoning traces to provide transparency about data sources.
 */
export interface ToolResult {
  /** Name of the tool that was executed (e.g., 'FRED', 'Polygon', 'NewsAPI') */
  tool: string;

  /** Result data returned by the tool (structure varies by tool) */
  result: any;
}

/**
 * Configuration constants for tool results storage
 */
export const TOOL_RESULTS_CONFIG = {
  /** Maximum number of tool results that can be attached to a single trace */
  MAX_TOOL_RESULTS: 100,
} as const;
