import { streamObject } from "ai";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListExtractionResults,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  LoadingListExtractionSchema,
  type LoadingListExtraction,
} from "@/lib/ai/schemas/loading-list-extraction";
import {
  LOADING_LIST_SYSTEM_PROMPT,
  LOADING_LIST_USER_PROMPT,
} from "@/lib/ai/prompts";

export const maxDuration = 60;

/**
 * Save extraction result to database
 */
async function saveExtractionResult(
  groupId: string,
  extraction: LoadingListExtraction
): Promise<void> {
  await db
    .delete(loadingListExtractionResults)
    .where(eq(loadingListExtractionResults.groupId, groupId));

  await db.insert(loadingListExtractionResults).values({
    groupId,
    status: extraction.status,
    message: extraction.message,
    activities: extraction.activities,
    lineItems: extraction.lineItems,
    summary: extraction.summary,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { groupId } = body;

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!groupId || !uuidRegex.test(groupId)) {
    return Response.json({ error: "Invalid group ID" }, { status: 400 });
  }

  try {
    // Get group with images
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, groupId),
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.orderIndex)],
        },
      },
    });

    if (!group) {
      return Response.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.images.length === 0) {
      return Response.json({ error: "No images in group" }, { status: 400 });
    }

    // Get ordered image URLs
    const imageUrls = group.images.map((img) => img.blobUrl);

    // Build content array with text prompt + images
    const content: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [
      { type: "text", text: LOADING_LIST_USER_PROMPT },
      ...imageUrls.map((url) => ({
        type: "image" as const,
        image: url,
      })),
    ];

    // Stream the object generation
    const result = streamObject({
      model: "google/gemini-2.5-flash-lite",
      schema: LoadingListExtractionSchema,
      schemaName: "LoadingListExtraction",
      schemaDescription: "Extracted activities and line items from loading list screenshots",
      messages: [
        { role: "system", content: LOADING_LIST_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      onFinish: async ({ object }) => {
        if (!object) {
          await db
            .update(employeeCaptureGroups)
            .set({ status: "needs_attention" })
            .where(eq(employeeCaptureGroups.id, groupId));
          return;
        }

        // Persist extraction result
        await saveExtractionResult(groupId, object);

        // Update group status
        const newStatus = object.status === "error" ? "needs_attention" : "extracted";
        await db
          .update(employeeCaptureGroups)
          .set({ status: newStatus })
          .where(eq(employeeCaptureGroups.id, groupId));
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Failed to extract group:", error);
    return Response.json({ error: "Failed to extract group" }, { status: 500 });
  }
}
