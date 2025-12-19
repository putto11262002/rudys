import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { employeeCaptureGroups, loadingListImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateSessionFromCookie } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  // Auth check
  const isValid = validateSessionFromCookie(request.headers.get("cookie"));
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { groupId } = await params;

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!groupId || !uuidRegex.test(groupId)) {
    return Response.json({ error: "Invalid group ID" }, { status: 400 });
  }

  try {
    // Verify group exists
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, groupId),
    });

    if (!group) {
      return Response.json({ error: "Group not found" }, { status: 404 });
    }

    // Parse FormData
    const formData = await request.formData();

    // Get all image files with their dimensions (named image_0, width_0, height_0, etc.)
    const imageData: Array<{ file: File; width: number; height: number }> = [];
    let index = 0;
    while (true) {
      const file = formData.get(`image_${index}`) as File | null;
      if (!file) break;

      const width = parseInt(formData.get(`width_${index}`) as string, 10);
      const height = parseInt(formData.get(`height_${index}`) as string, 10);

      if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        return Response.json(
          { error: `Invalid dimensions for image ${index}` },
          { status: 400 }
        );
      }

      imageData.push({ file, width, height });
      index++;
    }

    if (imageData.length === 0) {
      return Response.json(
        { error: "At least one image file is required" },
        { status: 400 }
      );
    }

    // Validate file types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    for (const { file } of imageData) {
      if (!allowedTypes.includes(file.type)) {
        return Response.json(
          { error: `Image ${file.name} must be JPEG, PNG, or WebP` },
          { status: 400 }
        );
      }
    }

    try {
      // Upload all images in parallel
      const uploadPromises = imageData.map(async ({ file, width, height }, idx) => {
        const ext = file.name.split(".").pop() || "jpg";
        const blob = await put(
          `sessions/${group.sessionId}/groups/${groupId}/${idx}.${ext}`,
          file,
          { access: "public", contentType: file.type }
        );
        return {
          orderIndex: idx,
          blobUrl: blob.url,
          width,
          height,
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);

      // Insert image records
      const now = new Date().toISOString();
      await db.insert(loadingListImages).values(
        uploadedImages.map((img) => ({
          groupId,
          orderIndex: img.orderIndex,
          blobUrl: img.blobUrl,
          width: img.width,
          height: img.height,
          captureType: "uploaded_file" as const,
          uploadedAt: now,
        }))
      );

      // Update group status to "pending" (ready for extraction)
      await db
        .update(employeeCaptureGroups)
        .set({ status: "pending" })
        .where(eq(employeeCaptureGroups.id, groupId));

      // Fetch the updated group with images
      const updatedGroup = await db.query.employeeCaptureGroups.findFirst({
        where: eq(employeeCaptureGroups.id, groupId),
        with: {
          images: {
            orderBy: (images, { asc }) => [asc(images.orderIndex)],
          },
        },
      });

      return Response.json({ group: updatedGroup });
    } catch (uploadError) {
      // Mark as needs_attention if upload failed
      await db
        .update(employeeCaptureGroups)
        .set({ status: "needs_attention" })
        .where(eq(employeeCaptureGroups.id, groupId));
      console.error("Failed to upload group images:", uploadError);
      return Response.json({ error: "Failed to upload images" }, { status: 500 });
    }
  } catch (error) {
    console.error("Failed to upload group images:", error);
    return Response.json({ error: "Failed to upload images" }, { status: 500 });
  }
}
