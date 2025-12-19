import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { stationCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateSessionFromCookie } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  // Auth check
  const isValid = validateSessionFromCookie(request.headers.get("cookie"));
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { stationId } = await params;

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!stationId || !uuidRegex.test(stationId)) {
    return Response.json({ error: "Invalid station ID" }, { status: 400 });
  }

  try {
    // Verify station exists
    const station = await db.query.stationCaptures.findFirst({
      where: eq(stationCaptures.id, stationId),
    });

    if (!station) {
      return Response.json({ error: "Station not found" }, { status: 404 });
    }

    // Parse FormData
    const formData = await request.formData();
    const signFile = formData.get("signImage") as File | null;
    const stockFile = formData.get("stockImage") as File | null;

    if (!signFile || !stockFile) {
      return Response.json(
        { error: "Both signImage and stockImage files are required" },
        { status: 400 }
      );
    }

    // Validate file types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(signFile.type)) {
      return Response.json(
        { error: "Sign image must be JPEG, PNG, or WebP" },
        { status: 400 }
      );
    }
    if (!allowedTypes.includes(stockFile.type)) {
      return Response.json(
        { error: "Stock image must be JPEG, PNG, or WebP" },
        { status: 400 }
      );
    }

    try {
      // Get file extensions
      const signExt = signFile.name.split(".").pop() || "jpg";
      const stockExt = stockFile.name.split(".").pop() || "jpg";

      // Upload both files to Vercel Blob
      const [signBlob, stockBlob] = await Promise.all([
        put(
          `sessions/${station.sessionId}/stations/${stationId}/sign.${signExt}`,
          signFile,
          { access: "public", contentType: signFile.type }
        ),
        put(
          `sessions/${station.sessionId}/stations/${stationId}/stock.${stockExt}`,
          stockFile,
          { access: "public", contentType: stockFile.type }
        ),
      ]);

      // Update station with image URLs and set status to "pending"
      const now = new Date().toISOString();
      await db
        .update(stationCaptures)
        .set({
          status: "pending",
          signBlobUrl: signBlob.url,
          signUploadedAt: now,
          stockBlobUrl: stockBlob.url,
          stockUploadedAt: now,
        })
        .where(eq(stationCaptures.id, stationId));

      // Fetch the updated station
      const updatedStation = await db.query.stationCaptures.findFirst({
        where: eq(stationCaptures.id, stationId),
      });

      return Response.json({ station: updatedStation });
    } catch (uploadError) {
      // Mark as needs_attention if upload failed
      await db
        .update(stationCaptures)
        .set({ status: "needs_attention" })
        .where(eq(stationCaptures.id, stationId));
      console.error("Failed to upload station images:", uploadError);
      return Response.json({ error: "Failed to upload images" }, { status: 500 });
    }
  } catch (error) {
    console.error("Failed to upload station images:", error);
    return Response.json({ error: "Failed to upload images" }, { status: 500 });
  }
}
