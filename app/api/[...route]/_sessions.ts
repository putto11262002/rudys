import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  sessions,
  sessionState,
  employeeCaptureGroups,
  loadingListImages,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { del } from "@vercel/blob";

// Define routes with CHAINING (critical for type inference)
export const sessionRoutes = new Hono()
  .get("/", async (c) => {
    // List all sessions
    try {
      const allSessions = await db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.createdAt));
      return c.json({ sessions: allSessions });
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      return c.json({ error: "Failed to fetch sessions" }, 500);
    }
  })
  .get(
    "/:id",
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      // Get single session
      const { id } = c.req.valid("param");
      try {
        const [session] = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, id));
        if (!session) {
          return c.json({ error: "Session not found" }, 404);
        }
        return c.json({ session });
      } catch (error) {
        console.error("Failed to fetch session:", error);
        return c.json({ error: "Failed to fetch session" }, 500);
      }
    }
  )
  .post("/", async (c) => {
    // Create new session
    try {
      const [session] = await db
        .insert(sessions)
        .values({ status: "capturing_loading_lists" })
        .returning();
      return c.json({ session }, 201);
    } catch (error) {
      console.error("Failed to create session:", error);
      return c.json({ error: "Failed to create session" }, 500);
    }
  })
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      // Delete session + cleanup blobs
      const { id } = c.req.valid("param");

      try {
        // Get all groups for this session
        const groups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, id),
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
          .where(eq(sessions.id, id))
          .returning({ id: sessions.id });

        if (!deleted) {
          return c.json({ error: "Session not found" }, 404);
        }

        return c.json({ success: true });
      } catch (error) {
        console.error("Failed to delete session:", error);
        return c.json({ error: "Failed to delete session" }, 500);
      }
    }
  )
  .patch(
    "/:id/status",
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", z.object({ status: z.enum(sessionState) })),
    async (c) => {
      // Update session status
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");

      try {
        const [updated] = await db
          .update(sessions)
          .set({ status })
          .where(eq(sessions.id, id))
          .returning({ id: sessions.id });

        if (!updated) {
          return c.json({ error: "Session not found" }, 404);
        }

        return c.json({ success: true });
      } catch (error) {
        console.error("Failed to update session status:", error);
        return c.json({ error: "Failed to update session status" }, 500);
      }
    }
  );
