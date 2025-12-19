import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stationCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateSessionFromCookie } from "@/lib/auth";

/**
 * Client payload for station image uploads
 */
interface StationImagePayload {
  stationId: string;
  sessionId: string;
  imageType: "sign" | "stock";
  width?: number;
  height?: number;
}

export async function POST(request: NextRequest) {
  // Auth check
  const isValid = validateSessionFromCookie(request.headers.get("cookie"));
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) {
          throw new Error("clientPayload is required");
        }

        const payload = JSON.parse(clientPayload) as StationImagePayload;

        if (!payload.stationId || !payload.sessionId || !payload.imageType) {
          throw new Error("stationId, sessionId, and imageType are required");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          console.error("[station-images] No tokenPayload in onUploadCompleted");
          return;
        }

        try {
          const payload = JSON.parse(tokenPayload) as StationImagePayload;
          const now = new Date().toISOString();

          if (payload.imageType === "sign") {
            await db
              .update(stationCaptures)
              .set({
                signBlobUrl: blob.url,
                signWidth: payload.width,
                signHeight: payload.height,
                signUploadedAt: now,
              })
              .where(eq(stationCaptures.id, payload.stationId));
          } else {
            await db
              .update(stationCaptures)
              .set({
                stockBlobUrl: blob.url,
                stockWidth: payload.width,
                stockHeight: payload.height,
                stockUploadedAt: now,
              })
              .where(eq(stationCaptures.id, payload.stationId));
          }

          // Check if both images are uploaded, then update status to pending
          const station = await db.query.stationCaptures.findFirst({
            where: eq(stationCaptures.id, payload.stationId),
          });

          if (station?.signBlobUrl && station?.stockBlobUrl) {
            await db
              .update(stationCaptures)
              .set({ status: "pending" })
              .where(eq(stationCaptures.id, payload.stationId));
            console.log(`[station-images] Both images uploaded, station status -> pending`);
          }

          console.log(`[station-images] Saved ${payload.imageType} image: ${blob.url}`);
        } catch (error) {
          console.error("[station-images] Error in onUploadCompleted:", error);
          throw error;
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[station-images] handleUpload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
