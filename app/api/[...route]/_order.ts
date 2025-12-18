import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions, demandSnapshots, stationCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Order item type (computed, not stored)
export type OrderItem = {
  productCode: string;
  demandQty: number;
  onHandQty: number;
  minQty: number | null;
  maxQty: number | null;
  recommendedOrderQty: number;
  exceedsMax: boolean;
};

// Define routes with CHAINING (critical for type inference)
export const orderRoutes = new Hono()
  // GET /sessions/:sessionId/order - Compute order from demand + stations
  .get(
    "/sessions/:sessionId/order",
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

        // Verify session is in correct state
        if (
          session.status !== "capturing_inventory" &&
          session.status !== "review_order" &&
          session.status !== "completed"
        ) {
          return c.json(
            { error: `Cannot view order in status: ${session.status}` },
            400
          );
        }

        // Verify demand is approved
        if (!session.demandSnapshot) {
          return c.json({ error: "Demand not approved yet" }, 400);
        }

        const demandItems = session.demandSnapshot.items;

        // Get all stations for this session
        const stations = await db.query.stationCaptures.findMany({
          where: eq(stationCaptures.sessionId, sessionId),
        });

        // Build order items by matching demand with stations
        const orderItems: OrderItem[] = [];
        const missingProducts: string[] = [];

        for (const demand of demandItems) {
          // Find valid station for this product
          const station = stations.find(
            (s) =>
              s.productCode === demand.productCode &&
              s.status === "valid" &&
              s.onHandQty !== null &&
              s.maxQty !== null
          );

          if (!station) {
            missingProducts.push(demand.productCode);
            continue;
          }

          const onHandQty = station.onHandQty!;
          const maxQty = station.maxQty!;
          const minQty = station.minQty;

          // Demand-first formula: order = max(0, demand - onHand)
          const recommendedOrderQty = Math.max(0, demand.demandQty - onHandQty);

          // Check if exceeds max
          const exceedsMax = onHandQty + recommendedOrderQty > maxQty;

          orderItems.push({
            productCode: demand.productCode,
            demandQty: demand.demandQty,
            onHandQty,
            minQty,
            maxQty,
            recommendedOrderQty,
            exceedsMax,
          });
        }

        // Coverage blocking: all demanded products must have valid stations
        if (missingProducts.length > 0) {
          return c.json(
            {
              error: "Coverage incomplete",
              missingProducts,
            },
            400
          );
        }

        // Sort by product code
        orderItems.sort((a, b) => a.productCode.localeCompare(b.productCode));

        // Mark session as completed when order is viewed
        if (session.status !== "completed") {
          await db
            .update(sessions)
            .set({ status: "completed" })
            .where(eq(sessions.id, sessionId));
        }

        return c.json({
          session: {
            id: session.id,
            createdAt: session.createdAt,
            status: "completed",
          },
          orderItems,
        });
      } catch (error) {
        console.error("Failed to compute order:", error);
        return c.json({ error: "Failed to compute order" }, 500);
      }
    }
  );
