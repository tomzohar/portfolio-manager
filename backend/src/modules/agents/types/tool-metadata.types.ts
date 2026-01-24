import { DynamicStructuredTool } from '@langchain/core/tools';

/**
 * Tool Metadata
 *
 * Enhanced metadata for tools to provide additional context in prompts.
 * Allows tools to specify important notes, warnings, and categorization.
 *
 * Implements index signature to be compatible with DynamicStructuredTool's
 * metadata property (Record<string, unknown>).
 */
export interface ToolMetadata extends Record<string, unknown> {
  /**
   * Important notes or warnings specific to this tool
   * Will be displayed after the tool description in prompts
   *
   * @example "When analyzing a user's portfolio, the portfolioId and userId are ALREADY AVAILABLE..."
   */
  notes?: string;

  /**
   * Category for grouping tools (future enhancement)
   * Can be used to organize tools by domain or function
   */
  category?: 'technical' | 'macro' | 'risk' | 'portfolio' | 'other';
}

/**
 * Enhanced Tool
 *
 * Extends DynamicStructuredTool with typed metadata field.
 * Allows tools to carry additional context for prompt generation.
 */
export interface EnhancedTool extends DynamicStructuredTool {
  metadata?: ToolMetadata;
}
