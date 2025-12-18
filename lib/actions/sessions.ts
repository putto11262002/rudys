"use server";

import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type ActionResult<T = unknown> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string };

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
