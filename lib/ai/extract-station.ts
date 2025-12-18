import { generateObject } from "ai";
import {
  StationExtractionSchema,
  type StationExtraction,
} from "./schemas/station-extraction";
import { STATION_SYSTEM_PROMPT, STATION_USER_PROMPT } from "./prompts";

// Default model if none specified
const DEFAULT_MODEL = "openai/gpt-4.1-nano";

/**
 * Extracts station data from sign and stock images.
 *
 * @param signUrl - Blob URL for the station sign image
 * @param stockUrl - Blob URL for the station stock image
 * @param modelId - Optional model ID to use for extraction
 * @returns Extraction result with productCode, min/max, onHand, matchStatus
 */
export async function extractStation(
  signUrl: string,
  stockUrl: string,
  modelId?: string
): Promise<StationExtraction> {
  if (!signUrl || !stockUrl) {
    throw new Error("Both sign and stock images are required");
  }

  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [
    { type: "text", text: STATION_USER_PROMPT },
    { type: "text", text: "Image A (SIGN):" },
    { type: "image", image: signUrl },
    { type: "text", text: "Image B (STOCK):" },
    { type: "image", image: stockUrl },
  ];

  const selectedModel = modelId || DEFAULT_MODEL;

  const { object } = await generateObject({
    model: selectedModel,
    schema: StationExtractionSchema,
    schemaName: "StationExtraction",
    schemaDescription:
      "Extracted station data from sign and stock images with match validation",
    messages: [
      { role: "system", content: STATION_SYSTEM_PROMPT },
      { role: "user", content },
    ],
  });

  return object;
}

/**
 * Safely extracts station data with error handling
 */
export async function safeExtractStation(
  signUrl: string,
  stockUrl: string,
  modelId?: string
): Promise<
  | { success: true; data: StationExtraction }
  | { success: false; error: string }
> {
  try {
    const data = await extractStation(signUrl, stockUrl, modelId);
    return { success: true, data };
  } catch (error) {
    console.error("Station extraction failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}
