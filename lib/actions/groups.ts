"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { employeeCaptureGroups, loadingListImages } from "@/lib/db/schema";

type ActionResult<T = unknown> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string };

const createGroupSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function createEmployeeGroup(
  sessionId: string
): Promise<ActionResult<{ groupId: string }>> {
  const parsed = createGroupSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid session ID",
    };
  }

  try {
    // Count existing groups to create a label
    const existingGroups = await db.query.employeeCaptureGroups.findMany({
      where: eq(employeeCaptureGroups.sessionId, parsed.data.sessionId),
    });
    const groupNumber = existingGroups.length + 1;

    const [group] = await db
      .insert(employeeCaptureGroups)
      .values({
        sessionId: parsed.data.sessionId,
        employeeLabel: `Employee ${groupNumber}`,
        status: "pending",
      })
      .returning({ id: employeeCaptureGroups.id });

    // Revalidate cache tags
    updateTag(`session:${parsed.data.sessionId}`);
    updateTag(`groups:${parsed.data.sessionId}`);

    return {
      ok: true,
      data: { groupId: group.id },
      message: "Employee group created",
    };
  } catch {
    return {
      ok: false,
      error: "Failed to create employee group",
    };
  }
}

const deleteGroupSchema = z.object({
  groupId: z.string().uuid(),
});

export async function deleteEmployeeGroup(
  groupId: string
): Promise<ActionResult<null>> {
  const parsed = deleteGroupSchema.safeParse({ groupId });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid group ID",
    };
  }

  try {
    // Get the group and its images to find sessionId and blob URLs
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, parsed.data.groupId),
    });

    if (!group) {
      return {
        ok: false,
        error: "Group not found",
      };
    }

    // Get all images in this group to delete their blobs
    const images = await db.query.loadingListImages.findMany({
      where: eq(loadingListImages.groupId, parsed.data.groupId),
    });

    // Delete blobs (best-effort)
    for (const image of images) {
      try {
        await del(image.blobUrl);
      } catch {
        // Log but continue - best effort deletion
        console.error(`Failed to delete blob: ${image.blobUrl}`);
      }
    }

    // Delete the group (cascade deletes images via FK)
    await db
      .delete(employeeCaptureGroups)
      .where(eq(employeeCaptureGroups.id, parsed.data.groupId));

    // Revalidate cache tags
    updateTag(`session:${group.sessionId}`);
    updateTag(`groups:${group.sessionId}`);

    return {
      ok: true,
      data: null,
      message: "Employee group deleted",
    };
  } catch {
    return {
      ok: false,
      error: "Failed to delete employee group",
    };
  }
}
