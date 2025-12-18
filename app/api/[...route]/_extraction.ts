import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListExtractionResults,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeExtractLoadingList } from "@/lib/ai/extract-loading-list";
import type { LoadingListExtraction } from "@/lib/ai/schemas/loading-list-extraction";

/**
 * Save extraction result to database
 */
async function saveExtractionResult(
  groupId: string,
  extraction: LoadingListExtraction
): Promise<void> {
  // Delete existing extraction result if any (for re-extraction)
  await db
    .delete(loadingListExtractionResults)
    .where(eq(loadingListExtractionResults.groupId, groupId));

  // Insert new extraction result
  await db.insert(loadingListExtractionResults).values({
    groupId,
    status: extraction.status,
    message: extraction.message,
    activities: extraction.activities,
    lineItems: extraction.lineItems,
    summary: extraction.summary,
  });
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

        // Persist extraction result
        await saveExtractionResult(groupId, extractionResult.data);

        // Update group status based on extraction status
        const newStatus =
          extractionResult.data.status === "error"
            ? "needs_attention"
            : "extracted";

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
        const result = await db.query.loadingListExtractionResults.findFirst({
          where: eq(loadingListExtractionResults.groupId, groupId),
        });

        if (!result) {
          return c.json({ result: null });
        }

        return c.json({
          result: {
            status: result.status,
            message: result.message,
            activities: result.activities,
            lineItems: result.lineItems,
            summary: result.summary,
          },
        });
      } catch (error) {
        console.error("Failed to get extraction result:", error);
        return c.json({ error: "Failed to get extraction result" }, 500);
      }
    }
  );
