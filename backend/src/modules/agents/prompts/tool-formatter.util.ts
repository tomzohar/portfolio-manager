import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EnhancedTool } from '../types/tool-metadata.types';

/**
 * Tool Formatter Utility
 *
 * Provides functions to dynamically format tool metadata into prompt-ready text.
 * Extracts information from Zod schemas and tool definitions to generate
 * consistent, accurate tool descriptions.
 */

/**
 * Get human-readable type name from Zod type
 *
 * Recursively unwraps Zod types to find the base type.
 * Handles wrappers like ZodOptional, ZodDefault, ZodEffects, etc.
 * Supports both older Zod v2 (_def.typeName) and newer Zod v3+ (def.type, .type) formats.
 *
 * Note: Uses 'any' for zodType to access Zod's internal structure across versions.
 * This is intentional for compatibility with different Zod versions.
 *
 * @param zodType - Zod type definition
 * @returns Human-readable type name
 */

function getZodTypeName(zodType: any): string {
  // Try to get the type from different Zod version formats
  // Zod v3+ uses def.type or .type directly on the object
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const typeFromDef = zodType.def?.type || zodType._def?.type;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const typeFromProp = zodType.type;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const typeName = zodType._def?.typeName;

  // Handle wrapped types first - Zod v3+ format
  // For optional and default, unwrap to get the inner type
  if (typeFromDef === 'optional' || typeFromProp === 'optional') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const innerType = zodType._def?.innerType || zodType.def?.innerType;
    if (innerType) {
      return getZodTypeName(innerType);
    }
  }
  if (typeFromDef === 'default' || typeFromProp === 'default') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const innerType = zodType._def?.innerType || zodType.def?.innerType;
    if (innerType) {
      return getZodTypeName(innerType);
    }
  }

  // Handle wrapped types - Zod v2 format (using typeName)
  if (typeName === 'ZodOptional') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return getZodTypeName(zodType._def.innerType);
  }
  if (typeName === 'ZodDefault') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return getZodTypeName(zodType._def.innerType);
  }
  if (typeName === 'ZodEffects') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return getZodTypeName(zodType._def.schema);
  }

  // Handle Zod v3+ base types (def.type or .type)
  if (typeFromDef || typeFromProp) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const actualType = typeFromDef || typeFromProp;
    if (actualType === 'string') return 'string';
    if (actualType === 'number') return 'number';
    if (actualType === 'boolean') return 'boolean';
    if (actualType === 'array') return 'array';
    if (actualType === 'object') return 'object';
    if (actualType === 'enum') return 'enum';
    if (actualType === 'union') return 'union';
    if (actualType === 'literal') return 'literal';
    if (actualType === 'date') return 'date';
    if (actualType === 'undefined') return 'undefined';
    if (actualType === 'null') return 'null';
    if (actualType === 'any') return 'any';
  }

  // Handle older Zod v2 format (_def.typeName)
  if (typeName) {
    if (typeName === 'ZodString') return 'string';
    if (typeName === 'ZodNumber') return 'number';
    if (typeName === 'ZodBoolean') return 'boolean';
    if (typeName === 'ZodArray') return 'array';
    if (typeName === 'ZodObject') return 'object';
    if (typeName === 'ZodEnum') return 'enum';
    if (typeName === 'ZodUnion') return 'union';
    if (typeName === 'ZodLiteral') return 'literal';
    if (typeName === 'ZodDate') return 'date';
    if (typeName === 'ZodUndefined') return 'undefined';
    if (typeName === 'ZodNull') return 'null';
    if (typeName === 'ZodAny') return 'any';
  }

  return 'unknown';
}

/**
 * Extract parameter details from Zod schema
 *
 * Parses a Zod object schema to extract parameter names, types, descriptions,
 * and optionality.
 *
 * Note: Uses 'any' for schema parameter to access Zod's internal structure.
 * This is intentional for compatibility with different Zod versions.
 *
 * @param schema - Zod object schema (may be wrapped by LangChain)
 * @returns Formatted parameter string
 */

function extractParameterDetails(schema: any): string {
  // Handle potential LangChain wrapping
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  let actualSchema = schema;

  // If schema has a _def property, it's a Zod schema
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (actualSchema._def) {
    // Check if it's wrapped (ZodEffects, ZodPipeline, etc.)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    while (actualSchema._def.schema) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      actualSchema = actualSchema._def.schema;
    }
  }

  // Get the shape - this is where the actual parameters are
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const shape = actualSchema.shape || actualSchema._def?.shape?.() || {};
  const params: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    const typeStr = getZodTypeName(zodType);
    const description = zodType.description || '';
    const optional = zodType.isOptional();

    const paramStr = `    ${key}: ${typeStr}${optional ? ' (optional)' : ''}${description ? ' - ' + description : ''}`;
    params.push(paramStr);
  }

  return params.join('\n');
}

/**
 * Format a single tool for display in prompt
 *
 * Generates a formatted string containing:
 * - Tool name
 * - Description
 * - Parameters (if any)
 * - Metadata notes (if present)
 *
 * @param tool - DynamicStructuredTool instance
 * @returns Formatted tool description
 *
 * @example
 * ```
 * - technical_analyst
 *   Description: Analyzes technical indicators
 *   Parameters:
 *     ticker: string - Stock ticker symbol
 *   NOTE: Use this tool for price trend analysis
 * ```
 */
export function formatTool(tool: DynamicStructuredTool): string {
  const enhancedTool = tool as EnhancedTool;
  let output = `- ${tool.name}\n`;
  output += `  Description: ${tool.description}\n`;

  // Extract parameters from schema
  // Tool.schema can be a Zod schema, even if not strictly a ZodObject instance
  if (tool.schema) {
    const params = extractParameterDetails(tool.schema);
    if (params && params.trim()) {
      output += `  Parameters:\n${params}\n`;
    }
  }

  // Add metadata notes if present
  if (enhancedTool.metadata?.notes) {
    output += `  NOTE: ${enhancedTool.metadata.notes}\n`;
  }

  return output;
}

/**
 * Format all tools into a section for the prompt
 *
 * Creates a complete tools section with header and all formatted tools.
 * Returns a user-friendly message if no tools are available.
 *
 * @param tools - Array of DynamicStructuredTool instances
 * @returns Formatted tools section ready for prompt injection
 *
 * @example
 * ```
 * **Available Tools:**
 * - technical_analyst
 *   Description: Analyzes technical indicators
 *   Parameters:
 *     ticker: string - Stock ticker symbol
 *
 * - macro_analyst
 *   Description: Analyzes market conditions
 * ```
 */
export function formatToolsSection(tools: DynamicStructuredTool[]): string {
  if (!tools || tools.length === 0) {
    return 'No tools available.';
  }

  const formattedTools = tools.map(formatTool).join('\n');

  return `**Available Tools:**\n${formattedTools}`;
}
