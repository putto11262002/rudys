"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { employeeCaptureGroups, loadingListImages } from "@/lib/db/schema";
import type { ActionResult } from "./types";

const createGroupSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function createEmployeeGroup(
  sessionId: string
): Promise<ActionResult<{ groupId: string }>> {
  const parsed = createGroupSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { ok: false, error: "Invalid session ID" };
  }

  try {
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

    return {
      ok: true,
      data: { groupId: group.id },
      message: "Group created",
    };
  } catch (error) {
    console.error("Failed to create employee group", error);
    return { ok: false, error: "Failed to create employee group" };
  }
}

const uploadImageSchema = z.object({
  groupId: z.string().uuid(),
  sessionId: z.string().uuid(),
  orderIndex: z.number().int().min(0),
});

export async function uploadGroupImage(
  groupId: string,
  sessionId: string,
  orderIndex: number,
  formData: FormData
): Promise<ActionResult<{ blobUrl: string }>> {
  const parsed = uploadImageSchema.safeParse({ groupId, sessionId, orderIndex });
  if (!parsed.success) {
    return { ok: false, error: "Invalid parameters" };
  }

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "No image provided" };
  }

  try {
    const blob = await put(
      `sessions/${sessionId}/loading-lists/${groupId}/${crypto.randomUUID()}.${file.name.split(".").pop()}`,
      file,
      { access: "public" }
    );

    await db.insert(loadingListImages).values({
      groupId: parsed.data.groupId,
      blobUrl: blob.url,
      captureType: "uploaded_file",
      orderIndex: parsed.data.orderIndex,
      width: 0,
      height: 0,
      uploadValidationPassed: true,
    });

    return {
      ok: true,
      data: { blobUrl: blob.url },
      message: "Image uploaded",
    };
  } catch (error) {
    console.error("Failed to upload image", error);
    return { ok: false, error: "Failed to upload image" };
  }
}

export async function finalizeGroup(
  sessionId: string
): Promise<ActionResult<null>> {
  // Revalidate cache after all uploads complete
  updateTag(`session:${sessionId}`);
  updateTag(`groups:${sessionId}`);
  return { ok: true, data: null, message: "Group finalized" };
}

const deleteGroupSchema = z.object({
  groupId: z.string().uuid(),
});

export async function deleteEmployeeGroup(
  groupId: string
): Promise<ActionResult<null>> {
  const parsed = deleteGroupSchema.safeParse({ groupId });
  if (!parsed.success) {
    return { ok: false, error: "Invalid group ID" };
  }

  try {
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, parsed.data.groupId),
    });

    if (!group) {
      return { ok: false, error: "Group not found" };
    }

    // Get all images to delete their blobs
    const images = await db.query.loadingListImages.findMany({
      where: eq(loadingListImages.groupId, parsed.data.groupId),
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

    // Delete the group (cascade deletes images via FK)
    await db
      .delete(employeeCaptureGroups)
      .where(eq(employeeCaptureGroups.id, parsed.data.groupId));

    // Revalidate cache
    updateTag(`session:${group.sessionId}`);
    updateTag(`groups:${group.sessionId}`);

    return { ok: true, data: null, message: "Employee group deleted" };
  } catch {
    return { ok: false, error: "Failed to delete employee group" };
  }
}
