"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { stationKeys } from "./query-keys";
import { sessionKeys } from "../sessions";
import { orderKeys } from "../order/query-keys";
import type { CoverageResponse } from "./types";

// ============================================================================
// Queries
// ============================================================================

/**
 * Fetches all stations for a session
 */
export function useStations(sessionId: string) {
  return useQuery({
    queryKey: stationKeys.listBySession(sessionId),
    queryFn: async () => {
      const res = await client.api.sessions[":sessionId"].stations.$get({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to fetch stations"
        );
      }
      return res.json();
    },
    enabled: !!sessionId,
  });
}

/**
 * Fetches coverage status for a session (which demanded products have valid stations)
 */
export function useCoverage(sessionId: string) {
  return useQuery({
    queryKey: stationKeys.coverage(sessionId),
    queryFn: async (): Promise<CoverageResponse> => {
      const res = await client.api.sessions[":sessionId"].coverage.$get({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to fetch coverage"
        );
      }
      return res.json() as Promise<CoverageResponse>;
    },
    enabled: !!sessionId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Phase 1: Create a pending station with "uploading" status (instant)
 * Returns immediately with stationId, form can clear and user can add next item
 */
export function useCreatePendingStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const res = await client.api.sessions[":sessionId"].stations["create-pending"].$post({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to create station"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { sessionId }) => {
      // Invalidate to show the new "uploading" station in the list
      queryClient.invalidateQueries({
        queryKey: stationKeys.listBySession(sessionId),
      });
    },
  });
}

/**
 * Phase 2: Upload images to an existing station (can run in background)
 * Updates station status from "uploading" to "pending" when complete
 */
export function useUploadStationImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stationId,
      sessionId,
      signImage,
      stockImage,
    }: {
      stationId: string;
      sessionId: string;
      signImage: {
        name: string;
        type: string;
        base64: string;
        width: number;
        height: number;
      };
      stockImage: {
        name: string;
        type: string;
        base64: string;
        width: number;
        height: number;
      };
    }) => {
      const res = await client.api.stations[":stationId"]["upload-images"].$post({
        param: { stationId },
        json: { signImage, stockImage },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to upload images"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { sessionId }) => {
      // Invalidate to update the station's status and images
      queryClient.invalidateQueries({
        queryKey: stationKeys.listBySession(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: stationKeys.coverage(sessionId),
      });
    },
  });
}

/**
 * Legacy: Creates a new station with sign and stock images in one request
 * @deprecated Use useCreatePendingStation + useUploadStationImages for better UX
 */
export function useCreateStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      signImage,
      stockImage,
    }: {
      sessionId: string;
      signImage: {
        name: string;
        type: string;
        base64: string;
        width: number;
        height: number;
      };
      stockImage: {
        name: string;
        type: string;
        base64: string;
        width: number;
        height: number;
      };
    }) => {
      const res = await client.api.sessions[":sessionId"].stations.$post({
        param: { sessionId },
        json: { signImage, stockImage },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to create station"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { sessionId }) => {
      // Invalidate station list and coverage
      queryClient.invalidateQueries({
        queryKey: stationKeys.listBySession(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: stationKeys.coverage(sessionId),
      });
      // Also invalidate session detail
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(sessionId),
      });
      // Invalidate order since it depends on stations
      queryClient.invalidateQueries({
        queryKey: orderKeys.bySession(sessionId),
      });
    },
  });
}

/**
 * Deletes a station
 */
export function useDeleteStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; sessionId: string }) => {
      const res = await client.api.stations[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to delete station"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { id, sessionId }) => {
      // Invalidate lists and remove the specific station from cache
      queryClient.invalidateQueries({
        queryKey: stationKeys.listBySession(sessionId),
      });
      queryClient.removeQueries({ queryKey: stationKeys.detail(id) });
      // Invalidate coverage
      queryClient.invalidateQueries({
        queryKey: stationKeys.coverage(sessionId),
      });
      // Also invalidate session detail
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(sessionId),
      });
      // Invalidate order since it depends on stations
      queryClient.invalidateQueries({
        queryKey: orderKeys.bySession(sessionId),
      });
    },
  });
}

/**
 * Runs AI extraction on a station
 */
export function useExtractStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      modelId,
    }: {
      id: string;
      sessionId: string;
      modelId?: string;
    }) => {
      const res = await client.api.stations[":id"].extract.$post({
        param: { id },
        json: { modelId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to extract station"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { id, sessionId }) => {
      // Invalidate station list and detail
      queryClient.invalidateQueries({
        queryKey: stationKeys.listBySession(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: stationKeys.detail(id),
      });
      // Invalidate coverage (extraction might change coverage status)
      queryClient.invalidateQueries({
        queryKey: stationKeys.coverage(sessionId),
      });
    },
  });
}
