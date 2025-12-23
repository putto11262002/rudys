"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { type StationExtraction } from "@/lib/ai/schemas/station-extraction";
import { stationKeys } from "./query-keys";
import { orderKeys } from "../order/query-keys";

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
    status: "uploading" | "pending" | "valid" | "needs_attention" | "failed";
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

// Response type from the extraction endpoint
interface ExtractionResponse {
  extraction: StationExtraction;
  details: {
    sign: {
      status: "success" | "warning" | "error";
      message?: string | null;
      productCode?: string | null;
      minQty?: number | null;
      maxQty?: number | null;
      model: string;
    };
    stock: {
      status: "success" | "warning" | "error";
      message?: string | null;
      onHandQty?: number | null;
      confidence?: "high" | "medium" | "low";
      countingMethod?: string;
      model: string;
    };
  };
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
 * Hook for station extraction using two parallel AI calls:
 * 1. Sign extraction (GPT-4o Mini) - reads product code, min, max
 * 2. Stock counting (Gemini 2.5 Flash) - counts items in stock photo
 *
 * Updates React Query cache directly when complete (no refetch needed).
 */
export function useStreamingStationExtraction({
  sessionId,
  onComplete,
  onError,
}: UseStreamingStationExtractionOptions) {
  const queryClient = useQueryClient();
  const currentStationIdRef = useRef<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const extract = useCallback(
    async (
      stationId: string,
      options?: {
        signModel?: string;
        stockModel?: string;
        signImageUrl?: string;
        stockImageUrl?: string;
      }
    ) => {
      currentStationIdRef.current = stationId;
      setIsExtracting(true);
      setError(null);
      setResult(null);

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/station-extract-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stationId,
            signModel: options?.signModel,
            stockModel: options?.stockModel,
            signImageUrl: options?.signImageUrl,
            stockImageUrl: options?.stockImageUrl,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Extraction failed");
        }

        const data: ExtractionResponse = await response.json();
        setResult(data);

        // Update the stations cache directly with the extraction result
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
                  status: mapExtractionStatusToStationStatus(data.extraction),
                  productCode: data.extraction.productCode ?? null,
                  minQty: data.extraction.minQty ?? null,
                  maxQty: data.extraction.maxQty ?? null,
                  onHandQty: data.extraction.onHandQty ?? null,
                  errorMessage:
                    data.extraction.status !== "success"
                      ? data.extraction.message ?? null
                      : null,
                  extractedAt: new Date().toISOString(),
                };
              }),
            };
          }
        );

        // Also invalidate coverage since extraction changes coverage status
        queryClient.invalidateQueries({
          queryKey: stationKeys.coverage(sessionId),
        });

        // Invalidate order since it depends on stations
        queryClient.invalidateQueries({
          queryKey: orderKeys.bySession(sessionId),
        });

        onComplete?.();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled, don't treat as error
          return;
        }
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);
      } finally {
        setIsExtracting(false);
      }
    },
    [sessionId, queryClient, onComplete, onError]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsExtracting(false);
    }
  }, []);

  return {
    /** Final extraction result (null while extracting) */
    result,
    /** Combined extraction result for backward compatibility */
    partialResult: result?.extraction ?? null,
    /** Detailed results from both sign and stock extraction */
    details: result?.details ?? null,
    /** Whether extraction is currently running */
    isExtracting,
    /** Whether extraction has completed successfully */
    isComplete: result !== null && !isExtracting,
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
