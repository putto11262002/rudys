import { generateObject } from "ai";
import {
  SignExtractionSchema,
  type SignExtraction,
} from "./schemas/sign-extraction";
import { SIGN_EXTRACTION_SYSTEM_PROMPT, SIGN_EXTRACTION_USER_PROMPT } from "./prompts";
import { DEFAULT_SIGN_MODEL } from "./models";

/**
 * Extracts product code, min, and max from a station sign image.
 * This is a simple OCR task - reads text from printed labels.
 *
 * @param signUrl - Blob URL for the station sign image
 * @param modelId - Optional model ID (defaults to GPT-4o Mini)
 * @returns Sign extraction result with productCode, minQty, maxQty
 */
export async function extractSign(
  signUrl: string,
  modelId?: string
): Promise<SignExtraction> {
  if (!signUrl) {
    throw new Error("Sign image URL is required");
  }

  const selectedModel = modelId || DEFAULT_SIGN_MODEL;

  const { object } = await generateObject({
    model: selectedModel,
    schema: SignExtractionSchema,
    schemaName: "SignExtraction",
    schemaDescription: "Extracted data from station sign label",
    messages: [
      { role: "system", content: SIGN_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: SIGN_EXTRACTION_USER_PROMPT },
          { type: "image", image: signUrl },
        ],
      },
    ],
  });

  return object;
}

/**
 * Safely extracts sign data with error handling
 */
export async function safeExtractSign(
  signUrl: string,
  modelId?: string
): Promise<
  | { success: true; data: SignExtraction }
  | { success: false; error: string }
> {
  try {
    const data = await extractSign(signUrl, modelId);
    return { success: true, data };
  } catch (error) {
    console.error("Sign extraction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}
