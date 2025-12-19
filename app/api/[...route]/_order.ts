import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions, employeeCaptureGroups, stationCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  computeDemandFromGroups,
  computeOrderItems,
  computeCoverage,
} from "@/lib/workflow/compute";

// Define routes with CHAINING (critical for type inference)
export const orderRoutes = new Hono()
  // GET /sessions/:sessionId/order - Compute order from demand + stations
  .get(
    "/sessions/:sessionId/order",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return c.json({ error: "Session not found" }, 404);
        }

        // Get groups with extraction and items
        const groups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, sessionId),
          with: {
            extraction: true,
            items: true,
          },
        });

        // Transform to GroupForComputation format
        const groupsForComputation = groups.map((group) => ({
          id: group.id,
          employeeLabel: group.employeeLabel,
          extraction: group.extraction
            ? {
                status: group.extraction.status,
                rawActivities: group.extraction.rawActivities,
                summary: group.extraction.summary,
                totalCost: group.extraction.totalCost,
              }
            : null,
          items: group.items.map((item) => ({
            productCode: item.productCode,
            quantity: item.quantity,
            activityCode: item.activityCode,
            description: item.description,
          })),
        }));

        const demandItems = computeDemandFromGroups(groupsForComputation);

        // Get stations
        const stations = await db.query.stationCaptures.findMany({
          where: eq(stationCaptures.sessionId, sessionId),
        });

        // Compute order with graceful handling
        const { computed, skipped } = computeOrderItems(demandItems, stations);

        // Compute coverage info
        const coverage = computeCoverage(demandItems, stations);

        return c.json({
          session: {
            id: session.id,
            createdAt: session.createdAt,
          },
          orderItems: computed,
          skippedItems: skipped,
          coverage,
        });
      } catch (error) {
        console.error("Failed to compute order:", error);
        return c.json({ error: "Failed to compute order" }, 500);
      }
    }
  );
