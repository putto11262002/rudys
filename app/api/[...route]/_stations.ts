import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { stationCaptures, sessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { safeExtractStation } from "@/lib/ai/extract-station";
import type { StationExtraction } from "@/lib/ai/schemas/station-extraction";

/**
 * Maps extraction status to station capture status
 */
function mapExtractionStatusToStationStatus(
  extraction: StationExtraction
): "valid" | "needs_attention" | "failed" {
  if (extraction.status === "success") {
    return "valid";
  }
  if (extraction.status === "error") {
    return "failed";
  }
  return "needs_attention"; // warning
}

// Define routes with CHAINING (critical for type inference)
export const stationRoutes = new Hono()
  // List stations for a session
  .get(
    "/sessions/:sessionId/stations",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        const stations = await db.query.stationCaptures.findMany({
          where: eq(stationCaptures.sessionId, sessionId),
          orderBy: [desc(stationCaptures.createdAt)],
        });

        return c.json({ stations });
      } catch (error) {
        console.error("Failed to fetch stations:", error);
        return c.json({ error: "Failed to fetch stations" }, 500);
      }
    },
  )
  // Phase 1: Create station with "uploading" status (instant, returns ID)
  .post(
    "/sessions/:sessionId/stations/create-pending",
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

        // Create station record with "uploading" status
        const [station] = await db
          .insert(stationCaptures)
          .values({
            sessionId,
            status: "uploading",
          })
          .returning();

        return c.json({ station }, 201);
      } catch (error) {
        console.error("Failed to create pending station:", error);
        return c.json({ error: "Failed to create station" }, 500);
      }
    },
  )
  // Phase 2: Upload images to existing station (can be called in background)
  .post(
    "/stations/:stationId/upload-images",
    zValidator("param", z.object({ stationId: z.string().uuid() })),
    zValidator(
      "json",
      z.object({
        signImage: z.object({
          name: z.string(),
          type: z.string(),
          base64: z.string(),
          width: z.number(),
          height: z.number(),
        }),
        stockImage: z.object({
          name: z.string(),
          type: z.string(),
          base64: z.string(),
          width: z.number(),
          height: z.number(),
        }),
      }),
    ),
    async (c) => {
      const { stationId } = c.req.valid("param");
      const { signImage, stockImage } = c.req.valid("json");

      try {
        // Verify station exists
        const station = await db.query.stationCaptures.findFirst({
          where: eq(stationCaptures.id, stationId),
        });

        if (!station) {
          return c.json({ error: "Station not found" }, 404);
        }

        try {
          // Upload sign image
          const signBuffer = Buffer.from(signImage.base64, "base64");
          const signExt = signImage.name.split(".").pop() || "jpg";
          const signBlob = await put(
            `sessions/${station.sessionId}/stations/${stationId}/sign.${signExt}`,
            signBuffer,
            { access: "public", contentType: signImage.type },
          );

          // Upload stock image
          const stockBuffer = Buffer.from(stockImage.base64, "base64");
          const stockExt = stockImage.name.split(".").pop() || "jpg";
          const stockBlob = await put(
            `sessions/${station.sessionId}/stations/${stationId}/stock.${stockExt}`,
            stockBuffer,
            { access: "public", contentType: stockImage.type },
          );

          // Update station with image URLs and set status to "pending"
          const now = new Date().toISOString();
          await db
            .update(stationCaptures)
            .set({
              status: "pending",
              signBlobUrl: signBlob.url,
              signWidth: signImage.width,
              signHeight: signImage.height,
              signUploadedAt: now,
              stockBlobUrl: stockBlob.url,
              stockWidth: stockImage.width,
              stockHeight: stockImage.height,
              stockUploadedAt: now,
            })
            .where(eq(stationCaptures.id, stationId));

          // Fetch the updated station
          const updatedStation = await db.query.stationCaptures.findFirst({
            where: eq(stationCaptures.id, stationId),
          });

          return c.json({ station: updatedStation });
        } catch (uploadError) {
          // Mark as needs_attention if upload failed
          await db
            .update(stationCaptures)
            .set({ status: "needs_attention" })
            .where(eq(stationCaptures.id, stationId));
          console.error("Failed to upload station images:", uploadError);
          return c.json({ error: "Failed to upload images" }, 500);
        }
      } catch (error) {
        console.error("Failed to upload station images:", error);
        return c.json({ error: "Failed to upload images" }, 500);
      }
    },
  )
  // Legacy: Create station with sign and stock images in one request
  .post(
    "/sessions/:sessionId/stations",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    zValidator(
      "json",
      z.object({
        signImage: z.object({
          name: z.string(),
          type: z.string(),
          base64: z.string(),
          width: z.number(),
          height: z.number(),
        }),
        stockImage: z.object({
          name: z.string(),
          type: z.string(),
          base64: z.string(),
          width: z.number(),
          height: z.number(),
        }),
      }),
    ),
    async (c) => {
      const { sessionId } = c.req.valid("param");
      const { signImage, stockImage } = c.req.valid("json");

      try {
        // Verify session exists
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return c.json({ error: "Session not found" }, 404);
        }

        // Create station record first to get ID
        const [station] = await db
          .insert(stationCaptures)
          .values({
            sessionId,
            status: "pending",
          })
          .returning({ id: stationCaptures.id });

        const stationId = station.id;

        try {
          // Upload sign image
          const signBuffer = Buffer.from(signImage.base64, "base64");
          const signExt = signImage.name.split(".").pop() || "jpg";
          const signBlob = await put(
            `sessions/${sessionId}/stations/${stationId}/sign.${signExt}`,
            signBuffer,
            { access: "public", contentType: signImage.type },
          );

          // Upload stock image
          const stockBuffer = Buffer.from(stockImage.base64, "base64");
          const stockExt = stockImage.name.split(".").pop() || "jpg";
          const stockBlob = await put(
            `sessions/${sessionId}/stations/${stationId}/stock.${stockExt}`,
            stockBuffer,
            { access: "public", contentType: stockImage.type },
          );

          // Update station with image URLs
          const now = new Date().toISOString();
          await db
            .update(stationCaptures)
            .set({
              signBlobUrl: signBlob.url,
              signWidth: signImage.width,
              signHeight: signImage.height,
              signUploadedAt: now,
              stockBlobUrl: stockBlob.url,
              stockWidth: stockImage.width,
              stockHeight: stockImage.height,
              stockUploadedAt: now,
            })
            .where(eq(stationCaptures.id, stationId));

          // Fetch the created station
          const createdStation = await db.query.stationCaptures.findFirst({
            where: eq(stationCaptures.id, stationId),
          });

          return c.json({ station: createdStation }, 201);
        } catch (uploadError) {
          // Cleanup: delete the station record if upload failed
          await db
            .delete(stationCaptures)
            .where(eq(stationCaptures.id, stationId));
          throw uploadError;
        }
      } catch (error) {
        console.error("Failed to create station:", error);
        return c.json({ error: "Failed to create station" }, 500);
      }
    },
  )
  // Delete station
  .delete(
    "/stations/:id",
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");

      try {
        const station = await db.query.stationCaptures.findFirst({
          where: eq(stationCaptures.id, id),
        });

        if (!station) {
          return c.json({ error: "Station not found" }, 404);
        }

        // Delete blobs (best-effort)
        const blobsToDelete = [
          station.signBlobUrl,
          station.stockBlobUrl,
        ].filter(Boolean) as string[];

        await Promise.all(
          blobsToDelete.map(async (url) => {
            try {
              await del(url);
            } catch {
              console.error(`Failed to delete blob: ${url}`);
            }
          }),
        );

        // Delete station record
        await db.delete(stationCaptures).where(eq(stationCaptures.id, id));

        return c.json({ success: true });
      } catch (error) {
        console.error("Failed to delete station:", error);
        return c.json({ error: "Failed to delete station" }, 500);
      }
    },
  )
  // Run extraction on station
  .post(
    "/stations/:id/extract",
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", z.object({ modelId: z.string().optional() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { modelId } = c.req.valid("json");

      try {
        const station = await db.query.stationCaptures.findFirst({
          where: eq(stationCaptures.id, id),
        });

        if (!station) {
          return c.json({ error: "Station not found" }, 404);
        }

        if (!station.signBlobUrl || !station.stockBlobUrl) {
          return c.json(
            { error: "Station must have both sign and stock images" },
            400,
          );
        }

        // Run AI extraction
        const extractionResult = await safeExtractStation(
          station.signBlobUrl,
          station.stockBlobUrl,
          modelId,
        );

        if (!extractionResult.success) {
          await db
            .update(stationCaptures)
            .set({ status: "needs_attention" })
            .where(eq(stationCaptures.id, id));

          return c.json({ error: extractionResult.error }, 500);
        }

        const extraction = extractionResult.data;

        // Map extraction status to station status
        const newStatus = mapExtractionStatusToStationStatus(extraction);

        // Update station with extraction results
        await db
          .update(stationCaptures)
          .set({
            status: newStatus,
            productCode: extraction.productCode,
            minQty: extraction.minQty,
            maxQty: extraction.maxQty,
            onHandQty: extraction.onHandQty,
            errorMessage: extraction.status !== "success" ? extraction.message : null,
            extractedAt: new Date().toISOString(),
          })
          .where(eq(stationCaptures.id, id));

        // Fetch updated station
        const updatedStation = await db.query.stationCaptures.findFirst({
          where: eq(stationCaptures.id, id),
        });

        return c.json({
          station: updatedStation,
          extraction: {
            status: extraction.status,
            message: extraction.message,
          },
        });
      } catch (error) {
        console.error("Failed to extract station:", error);
        return c.json({ error: "Failed to extract station" }, 500);
      }
    },
  )
  // Get coverage status for a session
  .get(
    "/sessions/:sessionId/coverage",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        // Get all groups with items
        const groups = await db.query.employeeCaptureGroups.findMany({
          where: eq(
            (await import("@/lib/db/schema")).employeeCaptureGroups.sessionId,
            sessionId,
          ),
          with: {
            extraction: true,
            items: true,
          },
        });

        // Aggregate demand from extracted items (with description)
        const demandMap = new Map<
          string,
          { qty: number; description: string | null }
        >();
        for (const group of groups) {
          if (!group.extraction) continue;
          if (group.extraction.status === "error") continue;

          for (const item of group.items) {
            const existing = demandMap.get(item.productCode);
            if (existing) {
              existing.qty += item.quantity;
              // Keep first non-null description
              if (!existing.description && item.description) {
                existing.description = item.description;
              }
            } else {
              demandMap.set(item.productCode, {
                qty: item.quantity,
                description: item.description,
              });
            }
          }
        }

        // Get all stations for this session
        const stations = await db.query.stationCaptures.findMany({
          where: eq(stationCaptures.sessionId, sessionId),
        });

        // Build coverage map with pessimistic defaults for uncaptured products
        const coverage = Array.from(demandMap.entries()).map(
          ([productCode, { qty: demandQty, description }]) => {
            // Find valid station with complete data
            const matchingStation = stations.find(
              (s) =>
                s.productCode === productCode &&
                s.status === "valid" &&
                s.onHandQty !== null &&
                s.maxQty !== null,
            );

            // isCaptured: station exists AND has images uploaded
            const isCaptured = !!(
              matchingStation?.signBlobUrl && matchingStation?.stockBlobUrl
            );

            // For uncaptured products: use pessimistic defaults
            // onHand=0, min=0, max=demand (order exactly what's needed)
            return {
              productCode,
              productDescription: description, // From AI extraction
              demandQty,
              isCaptured,
              stationId: matchingStation?.id,
              onHandQty: isCaptured ? (matchingStation.onHandQty ?? 0) : 0,
              minQty: matchingStation?.minQty ?? 0,
              maxQty: matchingStation?.maxQty ?? demandQty,
            };
          },
        );

        // Can always proceed - uncaptured products use defaults
        const coveredCount = coverage.filter((c) => c.isCaptured).length;
        const totalCount = coverage.length;

        return c.json({
          coverage,
          summary: {
            canProceed: true, // Always can proceed with defaults
            coveredCount,
            totalCount,
            percentage:
              totalCount > 0
                ? Math.round((coveredCount / totalCount) * 100)
                : 100,
          },
        });
      } catch (error) {
        console.error("Failed to get coverage:", error);
        return c.json({ error: "Failed to get coverage status" }, 500);
      }
    },
  );
