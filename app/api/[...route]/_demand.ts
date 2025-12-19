import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions, employeeCaptureGroups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  computeDemandFromGroups,
  computeExtractionStats,
} from "@/lib/workflow/compute";

// Define routes with CHAINING (critical for type inference)
export const demandRoutes = new Hono()
  // GET /sessions/:sessionId/demand - Get computed demand data
  .get(
    "/sessions/:sessionId/demand",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        // Verify session exists
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return c.json({ error: "Session not found" }, 404);
        }

        // Always compute from groups
        const groups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, sessionId),
          with: {
            extractionResult: true,
          },
        });

        const demandItems = computeDemandFromGroups(groups);
        const totalQuantity = demandItems.reduce(
          (sum, item) => sum + item.demandQty,
          0
        );
        const stats = computeExtractionStats(groups);

        return c.json({
          items: demandItems,
          totalProducts: demandItems.length,
          totalQuantity,
          stats,
        });
      } catch (error) {
        console.error("Failed to fetch demand:", error);
        return c.json({ error: "Failed to fetch demand" }, 500);
      }
    }
  );
