# Agent Prompts

This directory contains all LLM prompts used by the agent system. Prompts are extracted to external files for easier testing, version control, and iteration.

## Structure

```
prompts/
├── index.ts                          # Central exports
├── cio-reasoning.prompt.ts           # CIO reasoning prompt
├── cio-reasoning.prompt.spec.ts      # Prompt tests
└── README.md                         # This file
```

## Prompt File Pattern

Each prompt file follows this pattern:

```typescript
/**
 * Prompt documentation
 * 
 * Version: X.Y
 * Last Updated: YYYY-MM-DD
 */

export const PROMPT_NAME = `Your prompt template with {{placeholders}}`;

/**
 * Builder function documentation
 */
export function buildPromptName(params: string): string {
  return PROMPT_NAME.replace('{{placeholder}}', params);
}
```

## Usage

### Importing Prompts

```typescript
// Import from index for convenience
import { buildReasoningPrompt } from '../prompts';

// Or import directly
import { buildReasoningPrompt } from '../prompts/cio-reasoning.prompt';
```

### Using in Nodes

```typescript
export async function reasoningNode(state: CIOState) {
  const userQuery = extractUserQuery(state);
  const prompt = buildReasoningPrompt(userQuery);
  
  const response = await llm.invoke(prompt);
  return { messages: [new AIMessage(response.content)] };
}
```

## Testing Prompts

Each prompt file should have a corresponding `.spec.ts` file that tests:

1. **Placeholder replacement** - Ensures all placeholders are replaced
2. **Structure preservation** - Verifies prompt structure is maintained
3. **Edge cases** - Tests empty inputs, special characters, multiline text
4. **Content validation** - Checks that key instructions are present

Example:

```typescript
describe('buildReasoningPrompt', () => {
  it('should replace user query placeholder', () => {
    const result = buildReasoningPrompt('Test query');
    expect(result).toContain('Test query');
    expect(result).not.toContain('{{userQuery}}');
  });
});
```

## Prompt Engineering Best Practices

### 1. Clear Role Definition

Always start with a clear role definition:

```typescript
const PROMPT = `You are a Chief Investment Officer (CIO) AI assistant...`;
```

### 2. Structured Output

Use numbered lists to guide the LLM's response structure:

```typescript
Provide a response covering:
1. Current market context
2. Sector analysis
3. Risk factors
4. Recommendations
```

### 3. Quality Expectations

Be explicit about quality requirements:

```typescript
Be professional, informative, and specific. Avoid generic statements.
```

### 4. Placeholder Convention

Use `{{camelCase}}` for placeholders:

- ✅ `{{userQuery}}`
- ✅ `{{portfolioData}}`
- ❌ `{user_query}`
- ❌ `$USER_QUERY`

### 5. Versioning

Include version numbers in prompt documentation:

```typescript
/**
 * CIO Reasoning Prompt
 * 
 * Version: 1.0
 * Last Updated: 2026-01-17
 * 
 * Changes:
 * - 1.0: Initial version with 4-section structure
 */
```

## Prompt Iteration Workflow

### 1. Test First

Create or update tests to define expected behavior:

```typescript
it('should include risk analysis section', () => {
  const prompt = buildReasoningPrompt('Test');
  expect(prompt).toContain('Risk factors');
});
```

### 2. Update Prompt

Modify the prompt template:

```typescript
export const CIO_REASONING_PROMPT = `
New version with improved structure...
`;
```

### 3. Validate

Run tests to ensure changes work as expected:

```bash
npm test -- cio-reasoning.prompt.spec
```

### 4. Test in Production

Use the SSE streaming test to verify real LLM behavior:

```bash
node scripts/test-sse-token-streaming.js
```

### 5. Document Changes

Update version number and change log in the prompt file.

## Adding New Prompts

### 1. Create Prompt File

```bash
touch src/modules/agents/prompts/new-prompt.prompt.ts
```

### 2. Define Prompt and Builder

```typescript
export const NEW_PROMPT = `Your prompt with {{placeholder}}`;

export function buildNewPrompt(param: string): string {
  return NEW_PROMPT.replace('{{placeholder}}', param);
}
```

### 3. Create Tests

```bash
touch src/modules/agents/prompts/new-prompt.prompt.spec.ts
```

### 4. Export from Index

```typescript
// prompts/index.ts
export { NEW_PROMPT, buildNewPrompt } from './new-prompt.prompt';
```

### 5. Use in Node

```typescript
import { buildNewPrompt } from '../../prompts';

const prompt = buildNewPrompt(userInput);
```

## Prompt Performance Monitoring

Track prompt effectiveness:

### Metrics to Monitor

1. **Response Quality**
   - Does the LLM follow the structure?
   - Are responses specific vs generic?
   - Do users find responses helpful?

2. **Token Usage**
   - Prompt length (input tokens)
   - Response length (output tokens)
   - Cost per invocation

3. **Streaming Behavior**
   - Number of chunks
   - Time to first token
   - Total generation time

### A/B Testing Prompts

To test prompt variations:

```typescript
// Feature flag controlled
const promptVersion = process.env.PROMPT_VERSION || 'v1';

const prompt = promptVersion === 'v2' 
  ? buildReasoningPromptV2(query)
  : buildReasoningPrompt(query);
```

## Common Patterns

### Multi-Parameter Prompts

```typescript
export function buildComplexPrompt(
  userQuery: string,
  portfolioData: string,
  marketContext: string,
): string {
  return COMPLEX_PROMPT
    .replace('{{userQuery}}', userQuery)
    .replace('{{portfolioData}}', portfolioData)
    .replace('{{marketContext}}', marketContext);
}
```

### Conditional Sections

```typescript
export function buildConditionalPrompt(
  query: string,
  includeRiskAnalysis: boolean,
): string {
  let prompt = BASE_PROMPT.replace('{{query}}', query);
  
  if (includeRiskAnalysis) {
    prompt += '\n\nAdditional instruction: Include detailed risk analysis.';
  }
  
  return prompt;
}
```

### Template with Examples

```typescript
export const PROMPT_WITH_EXAMPLES = `
Analyze the following query: {{query}}

Example good response:
"Based on current market conditions, the technology sector..."

Example bad response:
"The market is doing well..."
`;
```

## Troubleshooting

### Issue: Placeholder Not Replaced

**Symptom:** Output contains `{{placeholder}}`

**Solution:** Check spelling of placeholder in both prompt and builder function.

### Issue: LLM Ignores Instructions

**Symptom:** Response doesn't follow structure

**Solutions:**
- Make instructions more explicit
- Add examples of desired output
- Emphasize important points with bold or ALL CAPS
- Test with different temperature settings

### Issue: Responses Too Generic

**Symptom:** Generic advice without specifics

**Solutions:**
- Add "Be specific" instruction
- Require concrete examples or data points
- Ask for numbered lists or bullet points
- Include "Avoid generic statements" directive

## Resources

- **LangChain Prompting Guide:** https://js.langchain.com/docs/modules/prompts/
- **OpenAI Prompt Engineering:** https://platform.openai.com/docs/guides/prompt-engineering
- **Anthropic Prompting Guide:** https://docs.anthropic.com/claude/docs/prompt-engineering

## Related Documentation

- `backend/docs/LESSONS_LEARNED_GAP_3.6.1-002.md` - SSE streaming implementation
- `backend/src/modules/agents/graphs/nodes/reasoning.node.ts` - Prompt usage example
