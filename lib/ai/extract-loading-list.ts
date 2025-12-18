import { generateObject } from "ai";
import {
  LoadingListExtractionSchema,
  type LoadingListExtraction,
} from "./schemas/loading-list-extraction";
import {
  LOADING_LIST_SYSTEM_PROMPT,
  LOADING_LIST_USER_PROMPT,
} from "./prompts";

/**
 * Extracts structured loading list data from a set of ordered images.
 *
 * Uses Vercel AI Gateway with GPT-4o-mini vision capabilities to analyze
 * Dutch "Laadlijst" screenshots and extract activities + line items.
 *
 * Requires AI_GATEWAY_API_KEY environment variable.
 *
 * @param imageUrls - Array of blob URLs in scroll order
 * @returns Extraction result matching LoadingListExtractionSchema
 */
export async function extractLoadingList(
  imageUrls: string[],
): Promise<LoadingListExtraction> {
  if (imageUrls.length === 0) {
    throw new Error("No images provided for extraction");
  }

  // Build content array with text prompt + images
  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [
    {
      type: "text",
      text: LOADING_LIST_USER_PROMPT,
    },
    // Add each image URL
    ...imageUrls.map((url) => ({
      type: "image" as const,
      image: url,
    })),
  ];

  // Use Vercel AI Gateway - pass model as string, AI_GATEWAY_API_KEY is auto-detected
  const { object } = await generateObject({
    model: "openai/gpt-5-nano",
    schema: LoadingListExtractionSchema,
    schemaName: "LoadingListExtraction",
    schemaDescription:
      "Extracted activities and line items from Dutch loading list screenshots",
    messages: [
      {
        role: "system",
        content: LOADING_LIST_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content,
      },
    ],
  });

  return object;
}

/**
 * Error type for extraction failures
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Safely extracts loading list data with error handling
 *
 * @param imageUrls - Array of blob URLs in scroll order
 * @returns Extraction result or null if extraction failed
 */
export async function safeExtractLoadingList(
  imageUrls: string[],
): Promise<
  | { success: true; data: LoadingListExtraction }
  | { success: false; error: string }
> {
  try {
    const data = await extractLoadingList(imageUrls);
    return { success: true, data };
  } catch (error) {
    console.error("Loading list extraction failed:", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Unknown extraction error" };
  }
}
