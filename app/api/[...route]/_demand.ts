import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  sessions,
  employeeCaptureGroups,
  demandSnapshots,
  type DemandItemJson,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Helper to compute demand from groups
function computeDemandFromGroups(
  groups: Array<{
    id: string;
    employeeLabel: string | null;
    extractionResult: {
      status: string;
      lineItems: Array<{
        primaryCode: string;
        quantity: number;
        description?: string;
        activityCode: string;
      }>;
    } | null;
  }>
): DemandItemJson[] {
  const demandMap = new Map<string, DemandItemJson>();

  for (const group of groups) {
    if (!group.extractionResult) continue;
    // Skip error groups
    if (group.extractionResult.status === "error") continue;

    for (const lineItem of group.extractionResult.lineItems) {
      const existing = demandMap.get(lineItem.primaryCode);
      if (existing) {
        existing.demandQty += lineItem.quantity;
        existing.sources.push({
          groupId: group.id,
          employeeLabel: group.employeeLabel,
          activityCode: lineItem.activityCode,
        });
      } else {
        demandMap.set(lineItem.primaryCode, {
          productCode: lineItem.primaryCode,
          demandQty: lineItem.quantity,
          description: lineItem.description,
          sources: [
            {
              groupId: group.id,
              employeeLabel: group.employeeLabel,
              activityCode: lineItem.activityCode,
            },
          ],
        });
      }
    }
  }

  // Sort by product code
  return Array.from(demandMap.values()).sort((a, b) =>
    a.productCode.localeCompare(b.productCode)
  );
}

// Define routes with CHAINING (critical for type inference)
export const demandRoutes = new Hono()
  // GET /sessions/:sessionId/demand - Get demand data
  .get(
    "/sessions/:sessionId/demand",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        // Get session with demand snapshot
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
          with: {
            demandSnapshot: true,
          },
        });

        if (!session) {
          return c.json({ error: "Session not found" }, 404);
        }

        // If already approved, return snapshot
        if (session.demandSnapshot) {
          return c.json({
            approved: true,
            snapshot: session.demandSnapshot,
            computed: null,
          });
        }

        // Otherwise compute from groups
        const groups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, sessionId),
          with: {
            extractionResult: true,
          },
        });

        const demandItems = computeDemandFromGroups(groups);
        const totalQuantity = demandItems.reduce((sum, item) => sum + item.demandQty, 0);

        return c.json({
          approved: false,
          snapshot: null,
          computed: {
            items: demandItems,
            totalProducts: demandItems.length,
            totalQuantity,
          },
        });
      } catch (error) {
        console.error("Failed to fetch demand:", error);
        return c.json({ error: "Failed to fetch demand" }, 500);
      }
    }
  )
  // POST /sessions/:sessionId/demand/approve - Approve demand
  .post(
    "/sessions/:sessionId/demand/approve",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        // Get session
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
          with: {
            demandSnapshot: true,
          },
        });

        if (!session) {
          return c.json({ error: "Session not found" }, 404);
        }

        // Check if already approved
        if (session.demandSnapshot) {
          return c.json({ error: "Demand already approved" }, 400);
        }

        // Check session is in correct state
        // User must navigate through "Continue to Review" which sets status to review_demand
        if (session.status !== "review_demand") {
          return c.json(
            { error: `Cannot approve demand in status: ${session.status}` },
            400
          );
        }

        // Compute demand from groups
        const groups = await db.query.employeeCaptureGroups.findMany({
          where: eq(employeeCaptureGroups.sessionId, sessionId),
          with: {
            extractionResult: true,
          },
        });

        const demandItems = computeDemandFromGroups(groups);

        // Block if empty demand
        if (demandItems.length === 0) {
          return c.json({ error: "Cannot approve empty demand" }, 400);
        }

        const totalQuantity = demandItems.reduce((sum, item) => sum + item.demandQty, 0);

        // Insert demand snapshot
        // Note: Neon HTTP driver doesn't support transactions, so we do sequential operations
        const [snapshot] = await db
          .insert(demandSnapshots)
          .values({
            sessionId,
            items: demandItems,
            totalProducts: demandItems.length,
            totalQuantity,
          })
          .returning();

        // Update session status
        await db
          .update(sessions)
          .set({ status: "capturing_inventory" })
          .where(eq(sessions.id, sessionId));

        return c.json({
          success: true,
          snapshot,
        });
      } catch (error) {
        console.error("Failed to approve demand:", error);
        return c.json({ error: "Failed to approve demand" }, 500);
      }
    }
  );
