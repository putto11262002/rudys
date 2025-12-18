import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loadingListImages } from "@/lib/db/schema";

interface ClientPayload {
  sessionId: string;
  groupId: string;
  imageId: string;
  width: number;
  height: number;
  captureType: "camera_photo" | "uploaded_file";
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Parse metadata from client
        if (!clientPayload) {
          throw new Error("Missing client payload");
        }

        const metadata: ClientPayload = JSON.parse(clientPayload);
        const { sessionId, groupId, imageId, width, height, captureType } =
          metadata;

        // Validate required fields
        if (!sessionId || !groupId || !imageId) {
          throw new Error(
            "Missing required metadata: sessionId, groupId, imageId"
          );
        }

        // Construct blob path per Constraints §5
        // sessions/{sessionId}/loading-lists/{groupId}/{imageId}.{ext}
        const ext = pathname.split(".").pop()?.toLowerCase() || "jpg";
        const blobPathname = `sessions/${sessionId}/loading-lists/${groupId}/${imageId}.${ext}`;

        return {
          // Constraints §1: Allowed MIME types
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          // Constraints §1: Max 10MB
          maximumSizeInBytes: 10 * 1024 * 1024,
          // Custom pathname per Constraints §5
          pathname: blobPathname,
          // Don't add random suffix since we control the path
          addRandomSuffix: false,
          // Pass metadata to callback
          tokenPayload: JSON.stringify({
            sessionId,
            groupId,
            imageId,
            width,
            height,
            captureType,
          }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          throw new Error("Missing token payload");
        }

        const { groupId, imageId, width, height, captureType }: ClientPayload =
          JSON.parse(tokenPayload);

        // Get next orderIndex for this group
        const existingImages = await db.query.loadingListImages.findMany({
          where: eq(loadingListImages.groupId, groupId),
        });
        const nextOrderIndex = existingImages.length;

        // Insert DB record
        await db.insert(loadingListImages).values({
          id: imageId,
          groupId,
          blobUrl: blob.url,
          captureType,
          orderIndex: nextOrderIndex,
          width,
          height,
          uploadValidationPassed: true,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
