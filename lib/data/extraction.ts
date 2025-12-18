import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListExtractionResults,
  type LoadingListExtractionResult,
  type EmployeeCaptureGroup,
} from "@/lib/db/schema";

export type GroupWithExtractionResult = EmployeeCaptureGroup & {
  extractionResult: Omit<LoadingListExtractionResult, "id" | "groupId" | "extractedAt"> | null;
};

/**
 * Get all groups with their extraction results for a session
 */
export const getGroupsWithExtractionResults = unstable_cache(
  async (sessionId: string): Promise<GroupWithExtractionResult[]> => {
    const groups = await db.query.employeeCaptureGroups.findMany({
      where: eq(employeeCaptureGroups.sessionId, sessionId),
      orderBy: (groups, { asc }) => [asc(groups.createdAt)],
    });

    // Fetch extraction results for each group
    const results = await Promise.all(
      groups.map(async (group) => {
        const extractionResult =
          await db.query.loadingListExtractionResults.findFirst({
            where: eq(loadingListExtractionResults.groupId, group.id),
          });

        return {
          ...group,
          extractionResult: extractionResult
            ? {
                imageChecks: extractionResult.imageChecks,
                activities: extractionResult.activities,
                lineItems: extractionResult.lineItems,
                ignoredImages: extractionResult.ignoredImages,
                warnings: extractionResult.warnings,
                summary: extractionResult.summary,
              }
            : null,
        };
      })
    );

    return results;
  },
  ["groups-with-extraction"],
  {
    tags: ["sessions"],
    revalidate: false,
  }
);

/**
 * Get extraction result for a single group
 */
export const getExtractionResult = unstable_cache(
  async (
    groupId: string
  ): Promise<LoadingListExtractionResult | null> => {
    const result = await db.query.loadingListExtractionResults.findFirst({
      where: eq(loadingListExtractionResults.groupId, groupId),
    });
    return result ?? null;
  },
  ["extraction-result"],
  {
    tags: ["extractions"],
    revalidate: false,
  }
);
