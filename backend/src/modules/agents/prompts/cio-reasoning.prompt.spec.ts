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

    it('should preserve prompt structure', () => {
      const userQuery = 'Test query';
      const result = buildReasoningPrompt(userQuery);

      expect(result).toContain('Chief Investment Officer');
      expect(result).toContain('Current market context and trends');
      expect(result).toContain('Specific sector or asset analysis');
      expect(result).toContain('Risk factors to consider');
      expect(result).toContain('Actionable recommendations');
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

    it('should include structured guidance', () => {
      expect(CIO_REASONING_PROMPT).toContain('1.');
      expect(CIO_REASONING_PROMPT).toContain('2.');
      expect(CIO_REASONING_PROMPT).toContain('3.');
      expect(CIO_REASONING_PROMPT).toContain('4.');
    });

    it('should emphasize quality expectations', () => {
      expect(CIO_REASONING_PROMPT).toContain('professional');
      expect(CIO_REASONING_PROMPT).toContain('specific');
      expect(CIO_REASONING_PROMPT).toContain('Avoid generic');
    });
  });
});
