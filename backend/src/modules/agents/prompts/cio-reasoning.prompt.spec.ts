import {
  CIO_REASONING_PROMPT,
  buildReasoningPrompt,
} from './cio-reasoning.prompt';

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

    it('should include tool descriptions', () => {
      expect(CIO_REASONING_PROMPT).toContain('technical_analyst');
      expect(CIO_REASONING_PROMPT).toContain('macro_analyst');
      expect(CIO_REASONING_PROMPT).toContain('risk_manager');
      expect(CIO_REASONING_PROMPT).toContain('Available Tools');
    });

    it('should emphasize data-driven analysis', () => {
      expect(CIO_REASONING_PROMPT).toContain('data-driven');
      expect(CIO_REASONING_PROMPT).toContain('insights');
      expect(CIO_REASONING_PROMPT).toContain('comprehensive');
    });
  });
});
