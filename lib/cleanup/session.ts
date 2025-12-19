import { db } from "@/lib/db";
import {
  sessions,
  employeeCaptureGroups,
  loadingListImages,
  stationCaptures,
} from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";
import { del } from "@vercel/blob";

/**
 * Deletes a session and all associated data including blob storage cleanup.
 * @param sessionId - The UUID of the session to delete
 * @returns Object with deletion results
 */
export async function deleteSessionWithCleanup(sessionId: string): Promise<{
  success: boolean;
  deletedBlobs: number;
  failedBlobs: number;
}> {
  let deletedBlobs = 0;
  let failedBlobs = 0;

  // 1. Get all groups for this session
  const groups = await db.query.employeeCaptureGroups.findMany({
    where: eq(employeeCaptureGroups.sessionId, sessionId),
  });

  // 2. Get all loading list images for all groups
  const allImages = await Promise.all(
    groups.map((group) =>
      db.query.loadingListImages.findMany({
        where: eq(loadingListImages.groupId, group.id),
      })
    )
  );

  // 3. Get all station captures for this session
  const stations = await db.query.stationCaptures.findMany({
    where: eq(stationCaptures.sessionId, sessionId),
  });

  // 4. Collect all blob URLs
  const blobUrls: string[] = [];

  // Loading list image blobs
  for (const img of allImages.flat()) {
    if (img.blobUrl) {
      blobUrls.push(img.blobUrl);
    }
  }

  // Station capture blobs (sign + stock images)
  for (const station of stations) {
    if (station.signBlobUrl) {
      blobUrls.push(station.signBlobUrl);
    }
    if (station.stockBlobUrl) {
      blobUrls.push(station.stockBlobUrl);
    }
  }

  // 5. Delete all blobs in parallel (best-effort)
  await Promise.all(
    blobUrls.map(async (url) => {
      try {
        await del(url);
        deletedBlobs++;
      } catch (error) {
        console.error(`Failed to delete blob: ${url}`, error);
        failedBlobs++;
      }
    })
  );

  // 6. Delete the session (cascade deletes all child records via FK)
  const [deleted] = await db
    .delete(sessions)
    .where(eq(sessions.id, sessionId))
    .returning({ id: sessions.id });

  return {
    success: !!deleted,
    deletedBlobs,
    failedBlobs,
  };
}

/**
 * Finds and deletes all sessions older than the specified age.
 * @param maxAgeMs - Maximum age in milliseconds (default: 7 days)
 * @returns Object with cleanup summary
 */
export async function cleanupOldSessions(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<{
  deletedSessions: number;
  deletedBlobs: number;
  failedBlobs: number;
  errors: string[];
}> {
  const cutoffDate = new Date(Date.now() - maxAgeMs).toISOString();
  const errors: string[] = [];
  let deletedSessions = 0;
  let totalDeletedBlobs = 0;
  let totalFailedBlobs = 0;

  // Find all sessions older than cutoff
  const oldSessions = await db
    .select({ id: sessions.id, createdAt: sessions.createdAt })
    .from(sessions)
    .where(lt(sessions.createdAt, cutoffDate));

  // Delete each session with cleanup
  for (const session of oldSessions) {
    try {
      const result = await deleteSessionWithCleanup(session.id);
      if (result.success) {
        deletedSessions++;
        totalDeletedBlobs += result.deletedBlobs;
        totalFailedBlobs += result.failedBlobs;
      }
    } catch (error) {
      const message = `Failed to delete session ${session.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(message);
      errors.push(message);
    }
  }

  return {
    deletedSessions,
    deletedBlobs: totalDeletedBlobs,
    failedBlobs: totalFailedBlobs,
    errors,
  };
}
