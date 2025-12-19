import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListExtractions,
  loadingListItems,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeExtractLoadingList } from "@/lib/ai/extract-loading-list";
import type { LoadingListExtraction } from "@/lib/ai/schemas/loading-list-extraction";

/**
 * Save extraction result and all items to database (no catalog validation)
 */
async function saveExtraction(
  groupId: string,
  extraction: LoadingListExtraction
): Promise<{ extractionId: string; itemCount: number }> {
  // Delete existing extraction and items for this group (for re-extraction)
  await db
    .delete(loadingListItems)
    .where(eq(loadingListItems.groupId, groupId));
  await db
    .delete(loadingListExtractions)
    .where(eq(loadingListExtractions.groupId, groupId));

  // Insert extraction record (raw AI output for audit)
  const [insertedExtraction] = await db
    .insert(loadingListExtractions)
    .values({
      groupId,
      status: extraction.status,
      message: extraction.message,
      rawActivities: extraction.activities,
      rawLineItems: extraction.lineItems,
      summary: extraction.summary,
    })
    .returning({ id: loadingListExtractions.id });

  const extractionId = insertedExtraction.id;

  // Insert ALL items (no catalog validation)
  if (extraction.lineItems.length > 0) {
    await db.insert(loadingListItems).values(
      extraction.lineItems.map((item) => ({
        groupId,
        extractionId,
        activityCode: item.activityCode,
        productCode: item.primaryCode,
        description: item.description,
        quantity: item.quantity,
        source: "extraction" as const,
      }))
    );
  }

  return {
    extractionId,
    itemCount: extraction.lineItems.length,
  };
}

// Define routes with CHAINING (critical for type inference)
export const extractionRoutes = new Hono()
  .post(
    "/groups/:groupId/extract",
    zValidator("param", z.object({ groupId: z.string().uuid() })),
    async (c) => {
      const { groupId } = c.req.valid("param");

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
          return c.json({ error: "Group not found" }, 404);
        }

        if (group.images.length === 0) {
          return c.json({ error: "No images in group" }, 400);
        }

        // Get ordered image URLs
        const imageUrls = group.images.map((img) => img.blobUrl);

        // Call AI extraction
        const extractionResult = await safeExtractLoadingList(imageUrls);

        if (!extractionResult.success) {
          await db
            .update(employeeCaptureGroups)
            .set({ status: "needs_attention" })
            .where(eq(employeeCaptureGroups.id, groupId));

          return c.json({ error: extractionResult.error }, 500);
        }

        // Save extraction (all items, no validation)
        const { itemCount } = await saveExtraction(groupId, extractionResult.data);

        // Determine group status
        const newStatus =
          extractionResult.data.status === "error" ? "needs_attention" : "extracted";

        await db
          .update(employeeCaptureGroups)
          .set({ status: newStatus })
          .where(eq(employeeCaptureGroups.id, groupId));

        return c.json({
          result: {
            groupId: group.id,
            status: extractionResult.data.status,
            message: extractionResult.data.message,
            summary: extractionResult.data.summary,
            itemCount,
          },
        });
      } catch (error) {
        console.error("Failed to extract group:", error);
        return c.json({ error: "Failed to extract group" }, 500);
      }
    }
  )
  .get(
    "/groups/:groupId/extraction",
    zValidator("param", z.object({ groupId: z.string().uuid() })),
    async (c) => {
      const { groupId } = c.req.valid("param");

      try {
        // Get extraction with items
        const extraction = await db.query.loadingListExtractions.findFirst({
          where: eq(loadingListExtractions.groupId, groupId),
          with: {
            items: true,
          },
        });

        if (!extraction) {
          return c.json({ result: null });
        }

        return c.json({
          result: {
            id: extraction.id,
            status: extraction.status,
            message: extraction.message,
            rawActivities: extraction.rawActivities,
            summary: extraction.summary,
            // All extracted items
            items: extraction.items.map((item) => ({
              id: item.id,
              activityCode: item.activityCode,
              productCode: item.productCode,
              description: item.description,
              quantity: item.quantity,
              source: item.source,
            })),
          },
        });
      } catch (error) {
        console.error("Failed to get extraction result:", error);
        return c.json({ error: "Failed to get extraction result" }, 500);
      }
    }
  );
