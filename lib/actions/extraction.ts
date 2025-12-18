"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListImages,
  loadingListExtractionResults,
  sessions,
} from "@/lib/db/schema";
import type { ActionResult } from "./types";
import { safeExtractLoadingList } from "@/lib/ai/extract-loading-list";
import type { LoadingListExtraction } from "@/lib/ai/schemas/loading-list-extraction";

const runExtractionSchema = z.object({
  sessionId: z.string().uuid(),
  groupIds: z.array(z.string().uuid()).optional(),
});

export type ExtractionResultSummary = {
  groupId: string;
  employeeLabel: string | null;
  status: "extracted" | "needs_attention" | "failed";
  summary: {
    totalLoadingListImages: number;
    totalActivities: number;
    totalLineItemsCounted: number;
    totalLineItemsIgnored: number;
  } | null;
  error?: string;
  warningCount: number;
  blockingWarningCount: number;
};

export type RunExtractionResult = {
  sessionId: string;
  results: ExtractionResultSummary[];
  totalGroups: number;
  successfulGroups: number;
  failedGroups: number;
};

/**
 * Runs loading list extraction for all groups in a session (or specific groups if provided).
 *
 * Flow:
 * 1. Validates session exists and is in correct status
 * 2. For each group:
 *    - Fetches ordered image URLs
 *    - Calls AI extraction
 *    - Persists extraction result to DB
 *    - Updates group status
 * 3. Updates session status to review_demand
 */
export async function runLoadingListExtraction(
  sessionId: string,
  groupIds?: string[]
): Promise<ActionResult<RunExtractionResult>> {
  const parsed = runExtractionSchema.safeParse({ sessionId, groupIds });
  if (!parsed.success) {
    return { ok: false, error: "Invalid session ID or group IDs" };
  }

  try {
    // Verify session exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, parsed.data.sessionId),
    });

    if (!session) {
      return { ok: false, error: "Session not found" };
    }

    // Get groups to process
    const groups = await db.query.employeeCaptureGroups.findMany({
      where: parsed.data.groupIds
        ? and(
            eq(employeeCaptureGroups.sessionId, parsed.data.sessionId),
            // Filter by specific group IDs if provided
          )
        : eq(employeeCaptureGroups.sessionId, parsed.data.sessionId),
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.orderIndex)],
        },
      },
    });

    // Filter by groupIds if specified
    const filteredGroups = parsed.data.groupIds
      ? groups.filter((g) => parsed.data.groupIds!.includes(g.id))
      : groups;

    if (filteredGroups.length === 0) {
      return { ok: false, error: "No groups found to process" };
    }

    const results: ExtractionResultSummary[] = [];

    // Process each group
    for (const group of filteredGroups) {
      const groupResult = await processGroupExtraction(group);
      results.push(groupResult);
    }

    // Update session status to review_demand if at least one group succeeded
    const successfulGroups = results.filter((r) => r.status === "extracted").length;
    if (successfulGroups > 0) {
      await db
        .update(sessions)
        .set({ status: "review_demand" })
        .where(eq(sessions.id, parsed.data.sessionId));
    }

    // Revalidate cache
    updateTag(`session:${sessionId}`);
    updateTag(`groups:${sessionId}`);

    return {
      ok: true,
      data: {
        sessionId: parsed.data.sessionId,
        results,
        totalGroups: filteredGroups.length,
        successfulGroups,
        failedGroups: results.filter((r) => r.status === "failed").length,
      },
      message: `Extraction completed for ${successfulGroups}/${filteredGroups.length} groups`,
    };
  } catch (error) {
    console.error("Failed to run loading list extraction:", error);
    return { ok: false, error: "Failed to run extraction" };
  }
}

/**
 * Process extraction for a single group
 */
async function processGroupExtraction(
  group: {
    id: string;
    employeeLabel: string | null;
    images: { id: string; blobUrl: string; orderIndex: number }[];
  }
): Promise<ExtractionResultSummary> {
  // Skip groups with no images
  if (group.images.length === 0) {
    return {
      groupId: group.id,
      employeeLabel: group.employeeLabel,
      status: "failed",
      summary: null,
      error: "No images in group",
      warningCount: 0,
      blockingWarningCount: 0,
    };
  }

  // Get ordered image URLs
  const imageUrls = group.images.map((img) => img.blobUrl);

  // Call AI extraction
  const extractionResult = await safeExtractLoadingList(imageUrls);

  if (!extractionResult.success) {
    // Mark group as needs_attention
    await db
      .update(employeeCaptureGroups)
      .set({ status: "needs_attention" })
      .where(eq(employeeCaptureGroups.id, group.id));

    return {
      groupId: group.id,
      employeeLabel: group.employeeLabel,
      status: "failed",
      summary: null,
      error: extractionResult.error,
      warningCount: 0,
      blockingWarningCount: 0,
    };
  }

  // Persist extraction result
  await saveExtractionResult(group.id, extractionResult.data);

  // Update image AI classification fields
  await updateImageClassifications(group.images, extractionResult.data);

  // Determine group status
  const blockingWarnings = extractionResult.data.warnings.filter(
    (w) => w.severity === "block"
  );
  const hasBlockingWarnings = blockingWarnings.length > 0;

  const newStatus = hasBlockingWarnings ? "needs_attention" : "extracted";

  // Update group status
  await db
    .update(employeeCaptureGroups)
    .set({ status: newStatus })
    .where(eq(employeeCaptureGroups.id, group.id));

  return {
    groupId: group.id,
    employeeLabel: group.employeeLabel,
    status: newStatus,
    summary: extractionResult.data.summary,
    warningCount: extractionResult.data.warnings.length,
    blockingWarningCount: blockingWarnings.length,
  };
}

/**
 * Save extraction result to database
 */
async function saveExtractionResult(
  groupId: string,
  extraction: LoadingListExtraction
): Promise<void> {
  // Delete existing extraction result if any (for re-extraction)
  await db
    .delete(loadingListExtractionResults)
    .where(eq(loadingListExtractionResults.groupId, groupId));

  // Insert new extraction result
  await db.insert(loadingListExtractionResults).values({
    groupId,
    imageChecks: extraction.imageChecks,
    activities: extraction.activities,
    lineItems: extraction.lineItems,
    ignoredImages: extraction.ignoredImages,
    warnings: extraction.warnings,
    summary: extraction.summary,
  });
}

/**
 * Update AI classification fields on images based on extraction result
 */
async function updateImageClassifications(
  images: { id: string; orderIndex: number }[],
  extraction: LoadingListExtraction
): Promise<void> {
  for (const imageCheck of extraction.imageChecks) {
    const image = images.find((img) => img.orderIndex === imageCheck.imageIndex);
    if (!image) continue;

    await db
      .update(loadingListImages)
      .set({
        aiClassificationIsLoadingList: imageCheck.isLoadingList,
        aiClassificationConfidence: imageCheck.loadingListConfidence,
        aiClassificationReason: imageCheck.notLoadingListReason || null,
      })
      .where(eq(loadingListImages.id, image.id));
  }
}

/**
 * Extract a single group - simpler action for immediate extraction after upload
 */
export async function extractGroup(
  sessionId: string,
  groupId: string
): Promise<ActionResult<ExtractionResultSummary>> {
  const sessionParsed = z.string().uuid().safeParse(sessionId);
  const groupParsed = z.string().uuid().safeParse(groupId);

  if (!sessionParsed.success || !groupParsed.success) {
    return { ok: false, error: "Invalid session or group ID" };
  }

  try {
    // Get group with images
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, groupParsed.data),
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.orderIndex)],
        },
      },
    });

    if (!group) {
      return { ok: false, error: "Group not found" };
    }

    if (group.sessionId !== sessionParsed.data) {
      return { ok: false, error: "Group does not belong to session" };
    }

    // Process extraction
    const result = await processGroupExtraction(group);

    // Revalidate cache
    updateTag(`session:${sessionId}`);
    updateTag(`groups:${sessionId}`);

    if (result.status === "failed") {
      return {
        ok: false,
        error: result.error || "Extraction failed",
      };
    }

    return {
      ok: true,
      data: result,
      message: "Extraction completed",
    };
  } catch (error) {
    console.error("Failed to extract group:", error);
    return { ok: false, error: "Failed to extract group" };
  }
}

/**
 * Get extraction result for a specific group
 */
export async function getGroupExtractionResult(
  groupId: string
): Promise<ActionResult<LoadingListExtraction | null>> {
  const parsed = z.string().uuid().safeParse(groupId);
  if (!parsed.success) {
    return { ok: false, error: "Invalid group ID" };
  }

  try {
    const result = await db.query.loadingListExtractionResults.findFirst({
      where: eq(loadingListExtractionResults.groupId, parsed.data),
    });

    if (!result) {
      return { ok: true, data: null, message: "No extraction result found" };
    }

    return {
      ok: true,
      data: {
        imageChecks: result.imageChecks,
        activities: result.activities,
        lineItems: result.lineItems,
        ignoredImages: result.ignoredImages,
        warnings: result.warnings,
        summary: result.summary,
      },
      message: "Extraction result retrieved",
    };
  } catch (error) {
    console.error("Failed to get extraction result:", error);
    return { ok: false, error: "Failed to get extraction result" };
  }
}
