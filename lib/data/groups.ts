import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { employeeCaptureGroups, loadingListImages } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function getGroupsWithImages(sessionId: string) {
  return unstable_cache(
    async () => {
      return db.query.employeeCaptureGroups.findMany({
        where: eq(employeeCaptureGroups.sessionId, sessionId),
        orderBy: [asc(employeeCaptureGroups.createdAt)],
        with: {
          images: {
            orderBy: [asc(loadingListImages.orderIndex)],
          },
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
