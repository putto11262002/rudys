import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListImages,
  loadingListExtractions,
  loadingListItems,
} from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { put, del } from "@vercel/blob";

/**
 * Invalidates extraction result for a group if it exists.
 * Resets group status to "pending" and deletes extraction result.
 * Call this when images are added/removed from a group.
 * @internal Reserved for future re-extraction feature
 */
async function _invalidateGroupExtraction(groupId: string): Promise<void> {
  // Check if group has extraction result
  const group = await db.query.employeeCaptureGroups.findFirst({
    where: eq(employeeCaptureGroups.id, groupId),
  });

  if (!group || group.status === "pending") {
    return; // Nothing to invalidate
  }

  // Delete items first (FK constraint)
  await db
    .delete(loadingListItems)
    .where(eq(loadingListItems.groupId, groupId));

  // Delete extraction
  await db
    .delete(loadingListExtractions)
    .where(eq(loadingListExtractions.groupId, groupId));

  // Reset AI classification on images
  await db
    .update(loadingListImages)
    .set({
      aiClassificationIsLoadingList: null,
      aiClassificationConfidence: null,
      aiClassificationReason: null,
    })
    .where(eq(loadingListImages.groupId, groupId));

  // Reset group status to pending
  await db
    .update(employeeCaptureGroups)
    .set({ status: "pending" })
    .where(eq(employeeCaptureGroups.id, groupId));
}

// Define routes with CHAINING (critical for type inference)
export const groupRoutes = new Hono()
  .get(
    "/sessions/:sessionId/groups",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      // List groups with images for a session
      const { sessionId } = c.req.valid("param");
      try {
        const groups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, sessionId),
          orderBy: [desc(employeeCaptureGroups.createdAt)], // Newest first
          with: {
            images: {
              orderBy: [asc(loadingListImages.orderIndex)],
            },
            extraction: true,
            items: true,
          },
        });

        return c.json({ groups });
      } catch (error) {
        console.error("Failed to fetch groups:", error);
        return c.json({ error: "Failed to fetch groups" }, 500);
      }
    }
  )
  // Phase 1: Create group with "uploading" status (instant, returns ID)
  .post(
    "/sessions/:sessionId/groups/create-pending",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    zValidator(
      "json",
      z.object({
        imageCount: z.number().min(1),
      })
    ),
    async (c) => {
      const { sessionId } = c.req.valid("param");
      const { imageCount } = c.req.valid("json");

      try {
        // Create the group with auto-numbered label and "uploading" status
        const existingGroups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, sessionId),
        });
        const groupNumber = existingGroups.length + 1;

        const [group] = await db
          .insert(employeeCaptureGroups)
          .values({
            sessionId,
            employeeLabel: `Employee ${groupNumber}`,
            status: "uploading",
          })
          .returning();

        return c.json(
          {
            group,
            expectedImages: imageCount,
          },
          201
        );
      } catch (error) {
        console.error("Failed to create pending group:", error);
        return c.json({ error: "Failed to create group" }, 500);
      }
    }
  )
  // Phase 2: Upload images to existing group (can be called in background)
  .post(
    "/groups/:groupId/upload-images",
    zValidator("param", z.object({ groupId: z.string().uuid() })),
    zValidator(
      "json",
      z.object({
        images: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            base64: z.string(),
            width: z.number(),
            height: z.number(),
          })
        ),
      })
    ),
    async (c) => {
      const { groupId } = c.req.valid("param");
      const { images } = c.req.valid("json");

      if (images.length === 0) {
        return c.json({ error: "No images provided" }, 400);
      }

      try {
        // Verify group exists and is in "uploading" status
        const group = await db.query.employeeCaptureGroups.findFirst({
          where: eq(employeeCaptureGroups.id, groupId),
        });

        if (!group) {
          return c.json({ error: "Group not found" }, 404);
        }

        // Upload all images in parallel
        const uploadResults = await Promise.all(
          images.map(async (img, index) => {
            try {
              const buffer = Buffer.from(img.base64, "base64");
              const ext = img.name.split(".").pop() || "jpg";

              const blob = await put(
                `sessions/${group.sessionId}/loading-lists/${groupId}/${crypto.randomUUID()}.${ext}`,
                buffer,
                { access: "public", contentType: img.type }
              );

              await db.insert(loadingListImages).values({
                groupId,
                blobUrl: blob.url,
                captureType: "uploaded_file",
                orderIndex: index,
                width: img.width,
                height: img.height,
                uploadValidationPassed: true,
              });

              return { ok: true };
            } catch (error) {
              console.error(`Failed to upload image ${index}:`, error);
              return { ok: false };
            }
          })
        );

        const failCount = uploadResults.filter((r) => !r.ok).length;
        const successCount = images.length - failCount;

        if (successCount === 0) {
          // All uploads failed - mark as needs_attention
          await db
            .update(employeeCaptureGroups)
            .set({ status: "needs_attention" })
            .where(eq(employeeCaptureGroups.id, groupId));
          return c.json({ error: "All image uploads failed" }, 500);
        }

        // Update status to "pending" (ready for extraction)
        await db
          .update(employeeCaptureGroups)
          .set({ status: "pending" })
          .where(eq(employeeCaptureGroups.id, groupId));

        // Fetch the updated group with images
        const updatedGroup = await db.query.employeeCaptureGroups.findFirst({
          where: eq(employeeCaptureGroups.id, groupId),
          with: {
            images: {
              orderBy: [asc(loadingListImages.orderIndex)],
            },
            extraction: true,
            items: true,
          },
        });

        return c.json({
          group: updatedGroup,
          uploadedCount: successCount,
          failedCount: failCount,
        });
      } catch (error) {
        console.error("Failed to upload images:", error);
        return c.json({ error: "Failed to upload images" }, 500);
      }
    }
  )
  // Legacy: Create group with images in one request (kept for backwards compatibility)
  .post(
    "/sessions/:sessionId/groups",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    zValidator(
      "json",
      z.object({
        images: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            base64: z.string(),
            width: z.number(),
            height: z.number(),
          })
        ),
      })
    ),
    async (c) => {
      // Create group with images (legacy single-request flow)
      const { sessionId } = c.req.valid("param");
      const { images } = c.req.valid("json");

      if (images.length === 0) {
        return c.json({ error: "No images provided" }, 400);
      }

      try {
        // 1. Create the group with auto-numbered label
        const existingGroups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, sessionId),
        });
        const groupNumber = existingGroups.length + 1;

        const [group] = await db
          .insert(employeeCaptureGroups)
          .values({
            sessionId,
            employeeLabel: `Employee ${groupNumber}`,
            status: "pending",
          })
          .returning({ id: employeeCaptureGroups.id });

        const groupId = group.id;

        // 2. Upload all images in parallel
        const uploadResults = await Promise.all(
          images.map(async (img, index) => {
            try {
              // Convert base64 to buffer
              const buffer = Buffer.from(img.base64, "base64");
              const ext = img.name.split(".").pop() || "jpg";

              const blob = await put(
                `sessions/${sessionId}/loading-lists/${groupId}/${crypto.randomUUID()}.${ext}`,
                buffer,
                { access: "public", contentType: img.type }
              );

              await db.insert(loadingListImages).values({
                groupId,
                blobUrl: blob.url,
                captureType: "uploaded_file",
                orderIndex: index,
                width: img.width,
                height: img.height,
                uploadValidationPassed: true,
              });

              return { ok: true };
            } catch (error) {
              console.error(`Failed to upload image ${index}:`, error);
              return { ok: false };
            }
          })
        );

        const failCount = uploadResults.filter((r) => !r.ok).length;
        if (failCount === images.length) {
          // All uploads failed - delete the group
          await db
            .delete(employeeCaptureGroups)
            .where(eq(employeeCaptureGroups.id, groupId));
          return c.json({ error: "All image uploads failed" }, 500);
        }

        // 3. Fetch the created group with images
        const createdGroup = await db.query.employeeCaptureGroups.findFirst({
          where: eq(employeeCaptureGroups.id, groupId),
          with: {
            images: {
              orderBy: [asc(loadingListImages.orderIndex)],
            },
            extraction: true,
            items: true,
          },
        });

        return c.json(
          {
            group: createdGroup,
            message:
              failCount > 0
                ? `Group created with ${images.length - failCount}/${images.length} images`
                : "Group created",
          },
          201
        );
      } catch (error) {
        console.error("Failed to create group with images:", error);
        return c.json({ error: "Failed to create group" }, 500);
      }
    }
  )
  .delete(
    "/groups/:id",
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      // Delete group and cleanup blobs
      const { id } = c.req.valid("param");

      try {
        const group = await db.query.employeeCaptureGroups.findFirst({
          where: eq(employeeCaptureGroups.id, id),
        });

        if (!group) {
          return c.json({ error: "Group not found" }, 404);
        }

        // Get all images to delete their blobs
        const images = await db.query.loadingListImages.findMany({
          where: eq(loadingListImages.groupId, id),
        });

        // Delete blobs in parallel (best-effort)
        await Promise.all(
          images.map(async (image) => {
            try {
              await del(image.blobUrl);
            } catch {
              console.error(`Failed to delete blob: ${image.blobUrl}`);
            }
          })
        );

        // Delete the group (cascade deletes images, items, rejected items via FK)
        await db
          .delete(employeeCaptureGroups)
          .where(eq(employeeCaptureGroups.id, id));

        return c.json({ success: true });
      } catch (error) {
        console.error("Failed to delete group:", error);
        return c.json({ error: "Failed to delete group" }, 500);
      }
    }
  );
