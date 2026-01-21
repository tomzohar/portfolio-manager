import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';

/**
 * ToolRegistryService
 *
 * Central registry for managing LangGraph tools.
 * Provides:
 * - Tool registration and retrieval
 * - NestJS-aware tool creation
 * - Tool lifecycle management
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools: Map<string, DynamicStructuredTool> = new Map();

  /**
   * Register a tool in the registry
   * If a tool with the same name exists, it will be overwritten
   *
   * @param tool - DynamicStructuredTool to register
   */
  registerTool(tool: DynamicStructuredTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(
        `Tool '${tool.name}' is being re-registered (overwriting previous)`,
      );
    }

    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Get all registered tools
   *
   * @returns Array of all registered tools
   */
  getTools(): DynamicStructuredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool by name
   *
   * @param name - Tool name
   * @returns The tool or undefined if not found
   */
  getTool(name: string): DynamicStructuredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   *
   * @param name - Tool name
   * @returns True if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get count of registered tools
   *
   * @returns Number of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools (useful for testing)
   */
  clearTools(): void {
    this.logger.debug('Clearing all registered tools');
    this.tools.clear();
  }
}
