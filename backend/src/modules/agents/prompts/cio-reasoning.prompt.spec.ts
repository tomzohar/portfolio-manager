import {
  CIO_REASONING_PROMPT,
  buildReasoningPrompt,
} from './cio-reasoning.prompt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EnhancedTool } from '../types/tool-metadata.types';

describe('CIO Reasoning Prompt', () => {
  describe('buildReasoningPrompt', () => {
    it('should replace user query placeholder', () => {
      const userQuery = 'What is the market outlook for tech stocks?';
      const result = buildReasoningPrompt(userQuery);

      expect(result).toContain(userQuery);
      expect(result).not.toContain('{{userQuery}}');
    });

    it('should preserve prompt structure with tools', () => {
      const userQuery = 'Test query';
      const result = buildReasoningPrompt(userQuery);

      expect(result).toContain('Chief Investment Officer');
      expect(result).toContain('Available Tools');
      expect(result).toContain('technical_analyst');
      expect(result).toContain('macro_analyst');
      expect(result).toContain('risk_manager');
    });

    it('should handle empty query', () => {
      const result = buildReasoningPrompt('');

      expect(result).not.toContain('{{userQuery}}');
      expect(result).toContain('Chief Investment Officer');
    });

    it('should handle special characters in query', () => {
      const userQuery = 'What about $AAPL & $GOOGL? Risk > 10%?';
      const result = buildReasoningPrompt(userQuery);

      expect(result).toContain(userQuery);
      expect(result).toContain('$AAPL');
      expect(result).toContain('&');
      expect(result).toContain('>');
    });

    it('should handle multiline queries', () => {
      const userQuery = `Line 1: Market analysis
Line 2: Sector breakdown
Line 3: Risk assessment`;
      const result = buildReasoningPrompt(userQuery);

      expect(result).toContain('Line 1: Market analysis');
      expect(result).toContain('Line 2: Sector breakdown');
      expect(result).toContain('Line 3: Risk assessment');
    });

    it('should include portfolio context when provided', () => {
      const userQuery = 'Analyze my portfolio';
      const portfolio = {
        id: 'portfolio-123',
        name: 'My Portfolio',
        totalValue: 50000,
        riskProfile: 'moderate',
        positions: [
          { ticker: 'AAPL', quantity: 10, marketValue: 1500 },
          { ticker: 'GOOGL', quantity: 5, marketValue: 700 },
        ],
      };
      const userId = 'user-456';

      const result = buildReasoningPrompt(userQuery, portfolio, userId);

      expect(result).toContain('Portfolio Context');
      expect(result).toContain('portfolio-123');
      expect(result).toContain('user-456');
      expect(result).toContain('My Portfolio');
      expect(result).toContain('50,000');
      expect(result).toContain('AAPL, GOOGL');
      expect(result).toContain('moderate');
      expect(result).toContain('IMPORTANT for risk_manager tool');
    });

    it('should not include portfolio section when no portfolio provided', () => {
      const userQuery = 'What is the market outlook?';
      const result = buildReasoningPrompt(userQuery);

      expect(result).not.toContain('Portfolio Context');
      expect(result).not.toContain('Holdings:');
    });
  });

  describe('CIO_REASONING_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof CIO_REASONING_PROMPT).toBe('string');
      expect(CIO_REASONING_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain user query placeholder', () => {
      expect(CIO_REASONING_PROMPT).toContain('{{userQuery}}');
    });

    it('should define CIO persona', () => {
      expect(CIO_REASONING_PROMPT).toContain('Chief Investment Officer');
    });

    it('should include tools placeholder', () => {
      expect(CIO_REASONING_PROMPT).toContain('{{tools}}');
      // Note: Actual tool descriptions are now dynamically generated
      // via buildReasoningPrompt() using the tools parameter
    });

    it('should emphasize conversational and approachable tone', () => {
      expect(CIO_REASONING_PROMPT).toContain('Conversational');
      expect(CIO_REASONING_PROMPT).toContain('approachable');
      expect(CIO_REASONING_PROMPT).toContain('insights');
    });
  });

  /**
   * Tests for Enhanced Prompt (LLM-Driven Routing Refactor)
   *
   * The enhanced prompt should guide the LLM to make routing decisions:
   * - Greetings → respond directly, no tools
   * - Help → describe capabilities, no tools
   * - Analysis → call tools strategically
   */
  describe('Enhanced Prompt - Routing Guidance', () => {
    it('should include RESPONSE STRATEGY section', () => {
      const prompt = buildReasoningPrompt('test query');
      expect(prompt).toContain('RESPONSE STRATEGY');
    });

    it('should include greeting routing guidance', () => {
      const prompt = buildReasoningPrompt('test query');
      expect(prompt).toContain('GREETINGS');
      expect(prompt).toContain('DO NOT call any tools');
    });

    it('should include few-shot examples', () => {
      const prompt = buildReasoningPrompt('test query');
      expect(prompt).toContain('Examples:');
      expect(prompt).toContain('User: "Hello"');
    });

    it('should include tone guidelines', () => {
      const prompt = buildReasoningPrompt('test query');
      expect(prompt).toContain('Conversational');
      expect(prompt.toLowerCase()).toContain('approachable');
    });

    it('should include capability questions guidance', () => {
      const prompt = buildReasoningPrompt('test query');
      expect(prompt).toContain('CAPABILITY QUESTIONS');
      expect(prompt).toContain('what can you do');
    });

    it('should include analysis request guidance', () => {
      const prompt = buildReasoningPrompt('test query');
      expect(prompt).toContain('ANALYSIS REQUESTS');
      expect(prompt).toContain('analyze');
      expect(prompt).toContain('market outlook');
    });
  });

  /**
   * Tests for Dynamic Tool Formatting
   *
   * Tool descriptions should be automatically generated from tool metadata
   * instead of being hardcoded in the prompt.
   */
  describe('buildReasoningPrompt with dynamic tools', () => {
    it('should include tool descriptions when tools provided', () => {
      const mockTool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'A test tool for analysis',
        schema: z.object({
          param1: z.string().describe('First parameter'),
        }),
        func: () => Promise.resolve('test'),
      });

      const result = buildReasoningPrompt('test query', undefined, undefined, [
        mockTool,
      ]);

      expect(result).toContain('Available Tools');
      expect(result).toContain('test_tool');
      expect(result).toContain('A test tool for analysis');
      expect(result).toContain('param1: string - First parameter');
    });

    it('should handle empty tools array', () => {
      const result = buildReasoningPrompt(
        'test query',
        undefined,
        undefined,
        [],
      );
      expect(result).toContain('No tools available');
    });

    it('should handle undefined tools parameter', () => {
      const result = buildReasoningPrompt('test query', undefined, undefined);
      // Should fall back to hardcoded tools
      expect(result).toContain('Available Tools');
    });

    it('should include tool metadata notes', () => {
      const toolWithMetadata = new DynamicStructuredTool({
        name: 'risk_manager',
        description: 'Calculates portfolio risk metrics',
        schema: z.object({
          portfolioId: z.string(),
          userId: z.string(),
        }),
        func: () => Promise.resolve('test'),
      });

      (toolWithMetadata as EnhancedTool).metadata = {
        notes: 'Use portfolio context values directly',
        category: 'risk',
      };

      const result = buildReasoningPrompt('test query', undefined, undefined, [
        toolWithMetadata,
      ]);

      expect(result).toContain('risk_manager');
      expect(result).toContain('NOTE: Use portfolio context values directly');
    });

    it('should format multiple tools correctly', () => {
      const tools = [
        new DynamicStructuredTool({
          name: 'technical_analyst',
          description: 'Technical indicators',
          schema: z.object({
            ticker: z.string(),
          }),
          func: () => Promise.resolve('test'),
        }),
        new DynamicStructuredTool({
          name: 'macro_analyst',
          description: 'Market analysis',
          schema: z.object({}),
          func: () => Promise.resolve('test'),
        }),
      ];

      const result = buildReasoningPrompt(
        'test query',
        undefined,
        undefined,
        tools,
      );

      expect(result).toContain('- technical_analyst');
      expect(result).toContain('- macro_analyst');
      expect(result).toContain('Technical indicators');
      expect(result).toContain('Market analysis');
    });

    it('should combine tools with portfolio context', () => {
      const tool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'Test',
        schema: z.object({}),
        func: () => Promise.resolve('test'),
      });

      const portfolio = {
        id: 'portfolio-123',
        name: 'My Portfolio',
        totalValue: 50000,
        positions: [{ ticker: 'AAPL', quantity: 10, marketValue: 1500 }],
      };

      const result = buildReasoningPrompt('test query', portfolio, 'user-456', [
        tool,
      ]);

      expect(result).toContain('test_tool');
      expect(result).toContain('Portfolio Context');
      expect(result).toContain('portfolio-123');
    });
  });
});
