"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect } from "react";
import { LoadingListExtractionSchema } from "@/lib/ai/schemas/loading-list-extraction";
import { extractionKeys } from "./query-keys";
import { groupKeys } from "../groups";

interface UseStreamingExtractionOptions {
  sessionId: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for streaming extraction using useObject from @ai-sdk/react.
 * Provides real-time partial results as the AI generates them.
 * Automatically invalidates React Query cache when complete.
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
    onFinish: () => {
      // Invalidate queries when complete
      if (currentGroupIdRef.current) {
        queryClient.invalidateQueries({
          queryKey: extractionKeys.result(currentGroupIdRef.current),
        });
        queryClient.invalidateQueries({
          queryKey: groupKeys.listBySession(sessionId),
        });
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
    (groupId: string) => {
      currentGroupIdRef.current = groupId;
      hasCompletedRef.current = false;
      // Submit with groupId in the body
      submit({ groupId });
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
