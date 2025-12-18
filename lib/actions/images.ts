"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { loadingListImages, employeeCaptureGroups } from "@/lib/db/schema";

type ActionResult<T = unknown> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string };

const reorderImagesSchema = z.object({
  groupId: z.string().uuid(),
  orderedImageIds: z.array(z.string().uuid()),
});

export async function reorderImages(
  groupId: string,
  orderedImageIds: string[]
): Promise<ActionResult<null>> {
  const parsed = reorderImagesSchema.safeParse({ groupId, orderedImageIds });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
    };
  }

  try {
    // Get the group to find sessionId
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, parsed.data.groupId),
    });

    if (!group) {
      return {
        ok: false,
        error: "Group not found",
      };
    }

    // Update orderIndex for each image
    for (let i = 0; i < parsed.data.orderedImageIds.length; i++) {
      await db
        .update(loadingListImages)
        .set({ orderIndex: i })
        .where(eq(loadingListImages.id, parsed.data.orderedImageIds[i]));
    }

    // Revalidate cache tags
    updateTag(`session:${group.sessionId}`);
    updateTag(`groups:${group.sessionId}`);

    return {
      ok: true,
      data: null,
      message: "Images reordered",
    };
  } catch {
    return {
      ok: false,
      error: "Failed to reorder images",
    };
  }
}

const deleteImageSchema = z.object({
  imageId: z.string().uuid(),
});

export async function deleteImage(
  imageId: string
): Promise<ActionResult<null>> {
  const parsed = deleteImageSchema.safeParse({ imageId });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid image ID",
    };
  }

  try {
    // Get the image to find blobUrl and groupId
    const image = await db.query.loadingListImages.findFirst({
      where: eq(loadingListImages.id, parsed.data.imageId),
    });

    if (!image) {
      return {
        ok: false,
        error: "Image not found",
      };
    }

    // Get the group to find sessionId
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, image.groupId),
    });

    // Delete blob (best-effort)
    try {
      await del(image.blobUrl);
    } catch {
      console.error(`Failed to delete blob: ${image.blobUrl}`);
    }

    // Delete from DB
    await db
      .delete(loadingListImages)
      .where(eq(loadingListImages.id, parsed.data.imageId));

    // Revalidate cache tags
    if (group) {
      updateTag(`session:${group.sessionId}`);
      updateTag(`groups:${group.sessionId}`);
    }

    return {
      ok: true,
      data: null,
      message: "Image deleted",
    };
  } catch {
    return {
      ok: false,
      error: "Failed to delete image",
    };
  }
}
