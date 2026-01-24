import { LLMModels } from '../types/lll-models.enum';

/**
 * Get the default Gemini model for the application.
 * Checks environment variable GEMINI_MODEL first, then defaults to GEMINI_3_PRO.
 *
 * @returns {string} The model name (e.g. 'models/gemini-3-pro-preview')
 */
export function getDefaultModel(): string {
  if (process.env.GEMINI_MODEL) {
    return process.env.GEMINI_MODEL;
  }
  return LLMModels.GEMINI_3_PRO;
}
