import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EnhancedTool } from '../types/tool-metadata.types';
import { formatTool, formatToolsSection } from './tool-formatter.util';

describe('Tool Formatter Utility', () => {
  describe('formatTool', () => {
    it('should format a basic tool with name and description', () => {
      const tool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'A test tool for unit testing',
        schema: z.object({}),
        func: () => Promise.resolve('test'),
      });

      const result = formatTool(tool);

      expect(result).toContain('- test_tool');
      expect(result).toContain('Description: A test tool for unit testing');
    });

    it('should format tool with string parameter', () => {
      const tool = new DynamicStructuredTool({
        name: 'ticker_tool',
        description: 'Analyzes a ticker',
        schema: z.object({
          ticker: z.string().describe('Stock ticker symbol'),
        }),
        func: () => Promise.resolve('test'),
      });

      const result = formatTool(tool);

      expect(result).toContain('- ticker_tool');
      expect(result).toContain('Description: Analyzes a ticker');
      expect(result).toContain('Parameters:');
      expect(result).toContain('ticker: string - Stock ticker symbol');
    });

    it('should format tool with multiple parameters', () => {
      const tool = new DynamicStructuredTool({
        name: 'multi_param_tool',
        description: 'Tool with multiple params',
        schema: z.object({
          portfolioId: z.string().describe('Portfolio ID'),
          userId: z.string().describe('User ID'),
          limit: z.number().describe('Result limit'),
        }),
        func: () => Promise.resolve('test'),
      });

      const result = formatTool(tool);

      expect(result).toContain('portfolioId: string - Portfolio ID');
      expect(result).toContain('userId: string - User ID');
      expect(result).toContain('limit: number - Result limit');
    });

    it('should mark optional parameters', () => {
      const tool = new DynamicStructuredTool({
        name: 'optional_param_tool',
        description: 'Tool with optional param',
        schema: z.object({
          required: z.string().describe('Required field'),
          optional: z.string().optional().describe('Optional field'),
        }),
        func: () => Promise.resolve('test'),
      });

      const result = formatTool(tool);

      expect(result).toContain('required: string - Required field');
      expect(result).toContain('optional: string (optional) - Optional field');
    });

    it('should include metadata notes when present', () => {
      const tool = new DynamicStructuredTool({
        name: 'risk_manager',
        description: 'Calculates risk metrics',
        schema: z.object({
          portfolioId: z.string(),
        }),
        func: () => Promise.resolve('test'),
      });

      (tool as EnhancedTool).metadata = {
        notes:
          'When analyzing a user portfolio, portfolioId is already available',
        category: 'risk',
      };

      const result = formatTool(tool);

      expect(result).toContain('- risk_manager');
      expect(result).toContain(
        'NOTE: When analyzing a user portfolio, portfolioId is already available',
      );
    });

    it('should handle tool with no parameters', () => {
      const tool = new DynamicStructuredTool({
        name: 'macro_analyst',
        description: 'Analyzes market conditions',
        schema: z.object({}),
        func: () => Promise.resolve('test'),
      });

      const result = formatTool(tool);

      expect(result).toContain('- macro_analyst');
      expect(result).toContain('Description: Analyzes market conditions');
      // Should not have Parameters section for empty schema
    });

    it('should handle different Zod types', () => {
      const tool = new DynamicStructuredTool({
        name: 'complex_tool',
        description: 'Tool with various types',
        schema: z.object({
          text: z.string().describe('Text field'),
          count: z.number().describe('Number field'),
          enabled: z.boolean().describe('Boolean field'),
          tags: z.array(z.string()).describe('Array field'),
        }),
        func: () => Promise.resolve('test'),
      });

      const result = formatTool(tool);

      expect(result).toContain('text: string - Text field');
      expect(result).toContain('count: number - Number field');
      expect(result).toContain('enabled: boolean - Boolean field');
      expect(result).toContain('tags: array - Array field');
    });

    it('should handle parameters with default values', () => {
      const tool = new DynamicStructuredTool({
        name: 'default_tool',
        description: 'Tool with defaults',
        schema: z.object({
          limit: z.number().default(10).describe('Result limit'),
        }),
        func: () => Promise.resolve('test'),
      });

      const result = formatTool(tool);

      expect(result).toContain('limit: number (optional) - Result limit');
    });
  });

  describe('formatToolsSection', () => {
    it('should format multiple tools into a section', () => {
      const tools = [
        new DynamicStructuredTool({
          name: 'technical_analyst',
          description: 'Technical indicators and trends',
          schema: z.object({
            ticker: z.string().describe('Stock ticker'),
          }),
          func: () => Promise.resolve('test'),
        }),
        new DynamicStructuredTool({
          name: 'macro_analyst',
          description: 'Market regime analysis',
          schema: z.object({}),
          func: () => Promise.resolve('test'),
        }),
      ];

      const result = formatToolsSection(tools);

      expect(result).toContain('**Available Tools:**');
      expect(result).toContain('- technical_analyst');
      expect(result).toContain('- macro_analyst');
      expect(result).toContain('Technical indicators and trends');
      expect(result).toContain('Market regime analysis');
    });

    it('should handle empty tools array', () => {
      const result = formatToolsSection([]);

      expect(result).toBe('No tools available.');
    });

    it('should handle undefined tools', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = formatToolsSection(undefined as any);

      expect(result).toBe('No tools available.');
    });

    it('should format tools with metadata', () => {
      const tool1 = new DynamicStructuredTool({
        name: 'risk_manager',
        description: 'Portfolio risk metrics',
        schema: z.object({
          portfolioId: z.string(),
          userId: z.string(),
        }),
        func: () => Promise.resolve('test'),
      });

      (tool1 as EnhancedTool).metadata = {
        notes: 'Use portfolio context values directly',
        category: 'risk',
      };

      const tools = [tool1];
      const result = formatToolsSection(tools);

      expect(result).toContain('**Available Tools:**');
      expect(result).toContain('- risk_manager');
      expect(result).toContain('NOTE: Use portfolio context values directly');
    });
  });
});
