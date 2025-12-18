"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { sessions, employeeCaptureGroups, loadingListImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ActionResult } from "./types";

export async function createSession(): Promise<void> {
  const [session] = await db
    .insert(sessions)
    .values({})
    .returning({ id: sessions.id });

  // Revalidate the sessions list (new session added)
  updateTag("sessions");

  redirect(`/sessions/${session.id}/loading-lists`);
}

const deleteSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function deleteSession(
  sessionId: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSessionSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid session ID",
    };
  }

  try {
    // Get all groups for this session
    const groups = await db.query.employeeCaptureGroups.findMany({
      where: eq(employeeCaptureGroups.sessionId, parsed.data.sessionId),
    });

    // Get all images for all groups
    const allImages = await Promise.all(
      groups.map((group) =>
        db.query.loadingListImages.findMany({
          where: eq(loadingListImages.groupId, group.id),
        })
      )
    );

    // Delete all blobs in parallel (best-effort)
    const blobUrls = allImages.flat().map((img) => img.blobUrl);
    await Promise.all(
      blobUrls.map(async (url) => {
        try {
          await del(url);
        } catch {
          console.error(`Failed to delete blob: ${url}`);
        }
      })
    );

    // Delete the session (cascade deletes groups and images via FK)
    const [deleted] = await db
      .delete(sessions)
      .where(eq(sessions.id, parsed.data.sessionId))
      .returning({ id: sessions.id });

    if (!deleted) {
      return {
        ok: false,
        error: "Session not found",
      };
    }

    // Revalidate both the list and the specific session cache
    updateTag("sessions");
    updateTag(`session:${parsed.data.sessionId}`);

    return {
      ok: true,
      data: null,
      message: "Session deleted successfully",
    };
  } catch {
    return {
      ok: false,
      error: "Failed to delete session",
    };
  }
}
