import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const getSessions = unstable_cache(
  async () => {
    return db.query.sessions.findMany({
      orderBy: [desc(sessions.createdAt)],
    });
  },
  ["sessions-list"],
  { tags: ["sessions"] }
);

export async function getSession(id: string) {
  return unstable_cache(
    async () => {
      return db.query.sessions.findFirst({
        where: eq(sessions.id, id),
      });
    },
    [`session-${id}`],
    { tags: ["sessions", `session:${id}`] }
  )();
}
