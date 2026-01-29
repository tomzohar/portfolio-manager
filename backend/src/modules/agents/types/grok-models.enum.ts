/**
 * Available Grok models from xAI
 *
 * See: https://sdk.vercel.ai/providers/ai-sdk-providers/xai
 */
export enum GrokModels {
    // Standard models
    GROK_4 = 'grok-4',
    GROK_4_FAST = 'grok-4-fast',
    GROK_4_FAST_REASONING = 'grok-4-1-fast-reasoning',

    // Non-reasoning variants (faster, cheaper)
    GROK_4_FAST_NON_REASONING = 'grok-4-1-fast-non-reasoning',

    // Legacy / Responses API model
    GROK_4_1_FAST = 'grok-4-1-fast',
}
