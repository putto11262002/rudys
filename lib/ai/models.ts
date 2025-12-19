/**
 * AI Model configuration for extraction tasks
 */

export interface Model {
  id: string;
  name: string;
  provider: "openai" | "google";
}

/**
 * Available models for extraction
 */
export const AVAILABLE_MODELS: Model[] = [
  { id: "openai/gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai" },
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano", provider: "openai" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
  },
];

/**
 * Default model for loading list extraction
 */
export const DEFAULT_LOADING_LIST_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Default model for station extraction
 */
export const DEFAULT_STATION_MODEL = "openai/gpt-4o-mini";

/**
 * Model pricing (per 1M tokens) - approximate costs
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "openai/gpt-5-nano": { input: 0.1, output: 0.4 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-flash-lite": { input: 0.075, output: 0.3 },
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

/**
 * Valid model IDs that can be selected
 */
export const VALID_MODEL_IDS = AVAILABLE_MODELS.map((m) => m.id);

/**
 * Calculate cost based on token usage and model
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_LOADING_LIST_MODEL];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
