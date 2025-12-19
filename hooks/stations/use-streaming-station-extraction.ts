"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect } from "react";
import {
  StationExtractionSchema,
  type StationExtraction,
} from "@/lib/ai/schemas/station-extraction";
import { stationKeys } from "./query-keys";

interface UseStreamingStationExtractionOptions {
  sessionId: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// Type for the stations query data (matches API response shape)
interface StationsQueryData {
  stations: Array<{
    id: string;
    sessionId: string;
    status: "pending" | "valid" | "needs_attention" | "failed";
    signBlobUrl: string | null;
    signWidth: number | null;
    signHeight: number | null;
    signUploadedAt: string | null;
    stockBlobUrl: string | null;
    stockWidth: number | null;
    stockHeight: number | null;
    stockUploadedAt: string | null;
    productCode: string | null;
    minQty: number | null;
    maxQty: number | null;
    onHandQty: number | null;
    errorMessage: string | null;
    extractedAt: string | null;
    createdAt: string;
  }>;
}

/**
 * Maps extraction status to station capture status
 */
function mapExtractionStatusToStationStatus(
  extraction: StationExtraction
): "valid" | "needs_attention" | "failed" {
  if (extraction.status === "success") {
    return "valid";
  }
  if (extraction.status === "error") {
    return "failed";
  }
  return "needs_attention"; // warning
}

/**
 * Hook for streaming station extraction using useObject from @ai-sdk/react.
 * Provides real-time partial results as the AI generates them.
 * Updates React Query cache directly when complete (no refetch needed).
 */
export function useStreamingStationExtraction({
  sessionId,
  onComplete,
  onError,
}: UseStreamingStationExtractionOptions) {
  const queryClient = useQueryClient();
  const currentStationIdRef = useRef<string | null>(null);
  const hasCompletedRef = useRef(false);

  const { object, submit, isLoading, error, stop } = useObject({
    api: "/api/station-extract-stream",
    schema: StationExtractionSchema,
    onFinish: (event) => {
      const stationId = currentStationIdRef.current;
      const finalObject = event.object as StationExtraction | undefined;

      if (stationId && finalObject) {
        // Update the stations cache directly with the streamed extraction result
        queryClient.setQueryData<StationsQueryData>(
          stationKeys.listBySession(sessionId),
          (oldData) => {
            if (!oldData) return oldData;

            return {
              ...oldData,
              stations: oldData.stations.map((station) => {
                if (station.id !== stationId) return station;

                // Update this station with extraction result
                return {
                  ...station,
                  status: mapExtractionStatusToStationStatus(finalObject),
                  productCode: finalObject.productCode ?? null,
                  minQty: finalObject.minQty ?? null,
                  maxQty: finalObject.maxQty ?? null,
                  onHandQty: finalObject.onHandQty ?? null,
                  errorMessage:
                    finalObject.status !== "success"
                      ? finalObject.message ?? null
                      : null,
                  extractedAt: new Date().toISOString(),
                };
              }),
            };
          }
        );

        // Also invalidate coverage since extraction changes coverage status
        // Coverage depends on server-side computation, so we need to refetch
        queryClient.invalidateQueries({
          queryKey: stationKeys.coverage(sessionId),
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
    (stationId: string, model?: string) => {
      currentStationIdRef.current = stationId;
      hasCompletedRef.current = false;
      // Submit with stationId and optional model in the body
      submit({ stationId, model });
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
    /** Start extraction for a station */
    extract,
    /** Stop the current extraction */
    stop,
    /** Error if extraction failed */
    error,
    /** Current station being extracted */
    stationId: currentStationIdRef.current,
  };
}
