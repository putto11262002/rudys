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
 * Extracts structured loading list data from ordered images.
 *
 * @param imageUrls - Array of blob URLs in scroll order
 * @returns Extraction result with status, activities, lineItems, summary
 */
export async function extractLoadingList(
  imageUrls: string[]
): Promise<LoadingListExtraction> {
  if (imageUrls.length === 0) {
    throw new Error("No images provided for extraction");
  }

  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [
    { type: "text", text: LOADING_LIST_USER_PROMPT },
    ...imageUrls.map((url) => ({
      type: "image" as const,
      image: url,
    })),
  ];

  const { object } = await generateObject({
    model: "openai/gpt-4.1-nano",
    schema: LoadingListExtractionSchema,
    schemaName: "LoadingListExtraction",
    schemaDescription: "Extracted activities and line items from loading list screenshots",
    messages: [
      { role: "system", content: LOADING_LIST_SYSTEM_PROMPT },
      { role: "user", content },
    ],
  });

  return object;
}

/**
 * Safely extracts loading list data with error handling
 */
export async function safeExtractLoadingList(
  imageUrls: string[]
): Promise<
  | { success: true; data: LoadingListExtraction }
  | { success: false; error: string }
> {
  try {
    const data = await extractLoadingList(imageUrls);
    return { success: true, data };
  } catch (error) {
    console.error("Loading list extraction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}
