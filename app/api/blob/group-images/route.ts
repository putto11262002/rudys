import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadingListImages, employeeCaptureGroups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateSessionFromCookie } from "@/lib/auth";

/**
 * Client payload for group image uploads
 */
interface GroupImagePayload {
  groupId: string;
  sessionId: string;
  index: number;
  width: number;
  height: number;
  totalImages: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Auth check - only for token generation (browser request with cookie)
        // The webhook callback from Vercel is authenticated via the blob token
        const isValid = validateSessionFromCookie(request.headers.get("cookie"));
        if (!isValid) {
          throw new Error("Unauthorized");
        }

        if (!clientPayload) {
          throw new Error("clientPayload is required");
        }

        const payload = JSON.parse(clientPayload) as GroupImagePayload;

        if (!payload.groupId || !payload.sessionId) {
          throw new Error("groupId and sessionId are required");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          console.error("[group-images] No tokenPayload in onUploadCompleted");
          return;
        }

        try {
          const payload = JSON.parse(tokenPayload) as GroupImagePayload;

          // Insert loading list image record
          await db.insert(loadingListImages).values({
            groupId: payload.groupId,
            blobUrl: blob.url,
            captureType: "uploaded_file",
            orderIndex: payload.index,
            width: payload.width,
            height: payload.height,
          });

          // Check if all images are uploaded, then update group status
          const uploadedImages = await db.query.loadingListImages.findMany({
            where: eq(loadingListImages.groupId, payload.groupId),
          });

          if (uploadedImages.length >= payload.totalImages) {
            await db
              .update(employeeCaptureGroups)
              .set({ status: "pending" })
              .where(eq(employeeCaptureGroups.id, payload.groupId));
            console.log(`[group-images] All ${payload.totalImages} images uploaded, group status -> pending`);
          }

          console.log(`[group-images] Saved image ${payload.index + 1}/${payload.totalImages}: ${blob.url}`);
        } catch (error) {
          console.error("[group-images] Error in onUploadCompleted:", error);
          throw error;
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[group-images] handleUpload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
