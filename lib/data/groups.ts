import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { employeeCaptureGroups, loadingListImages } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";

export async function getGroupsWithImages(sessionId: string) {
  return unstable_cache(
    async () => {
      return db.query.employeeCaptureGroups.findMany({
        where: eq(employeeCaptureGroups.sessionId, sessionId),
        orderBy: [desc(employeeCaptureGroups.createdAt)], // Newest first
        with: {
          images: {
            orderBy: [asc(loadingListImages.orderIndex)],
          },
          extractionResult: true,
        },
      });
    },
    [`groups-${sessionId}`],
    { tags: ["sessions", `session:${sessionId}`, `groups:${sessionId}`] }
  )();
}

export type GroupWithImages = Awaited<
  ReturnType<typeof getGroupsWithImages>
>[number];
