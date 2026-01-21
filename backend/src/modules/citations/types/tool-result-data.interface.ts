/**
 * ToolResultData Interface
 *
 * Defines the structure of tool results passed to citation extraction.
 * Tool results come from agent tool executions (FRED, Polygon, NewsAPI, etc.)
 */
export interface ToolResultData {
  /** Name of the tool that was executed */
  tool: string;

  /** Result data from the tool (structure varies by tool) */
  result: Record<string, unknown>;
}
