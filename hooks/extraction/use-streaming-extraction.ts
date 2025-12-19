"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect } from "react";
import {
  LoadingListExtractionSchema,
  type LoadingListExtraction,
} from "@/lib/ai/schemas/loading-list-extraction";
import { groupKeys } from "../groups";

interface UseStreamingExtractionOptions {
  sessionId: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// Type for the groups query data (matches API response shape)
interface GroupsQueryData {
  groups: Array<{
    id: string;
    sessionId: string;
    employeeLabel: string;
    status: "pending" | "extracted" | "needs_attention";
    createdAt: string;
    images: Array<{
      id: string;
      groupId: string;
      blobUrl: string;
      orderIndex: number;
      width: number | null;
      height: number | null;
    }>;
    extractionResult: {
      id: string;
      groupId: string;
      status: "success" | "warning" | "error";
      message: string | null;
      activities: Array<{ activityCode: string }>;
      lineItems: Array<{
        activityCode: string;
        primaryCode: string;
        quantity: number;
      }>;
      summary: {
        totalImages: number;
        validImages: number;
        totalActivities: number;
        totalLineItems: number;
      };
    } | null;
  }>;
}

/**
 * Hook for streaming extraction using useObject from @ai-sdk/react.
 * Provides real-time partial results as the AI generates them.
 * Updates React Query cache directly when complete (no refetch needed).
 */
export function useStreamingExtraction({
  sessionId,
  onComplete,
  onError,
}: UseStreamingExtractionOptions) {
  const queryClient = useQueryClient();
  const currentGroupIdRef = useRef<string | null>(null);
  const hasCompletedRef = useRef(false);

  const { object, submit, isLoading, error, stop } = useObject({
    api: "/api/extract-stream",
    schema: LoadingListExtractionSchema,
    onFinish: (event) => {
      const groupId = currentGroupIdRef.current;
      const finalObject = event.object as LoadingListExtraction | undefined;

      if (groupId && finalObject) {
        // Update the groups cache directly with the streamed extraction result
        queryClient.setQueryData<GroupsQueryData>(
          groupKeys.listBySession(sessionId),
          (oldData) => {
            if (!oldData) return oldData;

            return {
              ...oldData,
              groups: oldData.groups.map((group) => {
                if (group.id !== groupId) return group;

                // Update this group with extraction result
                return {
                  ...group,
                  status: finalObject.status === "error" ? "needs_attention" : "extracted",
                  extractionResult: {
                    id: crypto.randomUUID(), // Temporary ID, will be replaced on next server fetch
                    groupId,
                    status: finalObject.status,
                    message: finalObject.message ?? null,
                    activities: finalObject.activities,
                    lineItems: finalObject.lineItems,
                    summary: finalObject.summary,
                  },
                } as typeof group;
              }),
            };
          }
        );
      }

      hasCompletedRef.current = true;
      onComplete?.();
    },
    onError: (err) => {
      onError?.(err);
    },
  });

  // Reset completion flag when starting new extraction
  useEffect(() => {
    if (isLoading) {
      hasCompletedRef.current = false;
    }
  }, [isLoading]);

  const extract = useCallback(
    (groupId: string, model?: string) => {
      currentGroupIdRef.current = groupId;
      hasCompletedRef.current = false;
      // Submit with groupId and optional model in the body
      submit({ groupId, model });
    },
    [submit]
  );

  return {
    /** Partial extraction result (updates as stream progresses) */
    partialResult: object,
    /** Whether extraction is currently streaming */
    isExtracting: isLoading,
    /** Whether extraction has completed */
    isComplete: hasCompletedRef.current,
    /** Start extraction for a group */
    extract,
    /** Stop the current extraction */
    stop,
    /** Error if extraction failed */
    error,
    /** Current group being extracted */
    groupId: currentGroupIdRef.current,
  };
}
