import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions, sessionPhase } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { deleteSessionWithCleanup } from "@/lib/cleanup/session";

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
        .values({ lastPhase: "loading-lists" })
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
      // Delete session + cleanup blobs (including station captures)
      const { id } = c.req.valid("param");

      try {
        const result = await deleteSessionWithCleanup(id);

        if (!result.success) {
          return c.json({ error: "Session not found" }, 404);
        }

        return c.json({
          success: true,
          deletedBlobs: result.deletedBlobs,
          failedBlobs: result.failedBlobs,
        });
      } catch (error) {
        console.error("Failed to delete session:", error);
        return c.json({ error: "Failed to delete session" }, 500);
      }
    }
  )
  .patch(
    "/:id/phase",
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", z.object({ lastPhase: z.enum(sessionPhase) })),
    async (c) => {
      // Update session last phase (for resume)
      const { id } = c.req.valid("param");
      const { lastPhase } = c.req.valid("json");

      try {
        const [updated] = await db
          .update(sessions)
          .set({ lastPhase })
          .where(eq(sessions.id, id))
          .returning();

        if (!updated) {
          return c.json({ error: "Session not found" }, 404);
        }

        return c.json({ session: updated });
      } catch (error) {
        console.error("Failed to update session phase:", error);
        return c.json({ error: "Failed to update session phase" }, 500);
      }
    }
  );
