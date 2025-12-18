"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { extractionKeys } from "./query-keys";
import { groupKeys } from "../groups";

// ============================================================================
// Queries
// ============================================================================

export function useExtractionResult(groupId: string) {
  return useQuery({
    queryKey: extractionKeys.result(groupId),
    queryFn: async () => {
      const res = await client.api.groups[":groupId"].extraction.$get({
        param: { groupId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to fetch extraction result"
        );
      }
      return res.json();
    },
    enabled: !!groupId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useExtractGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId }: { groupId: string; sessionId: string }) => {
      const res = await client.api.groups[":groupId"].extract.$post({
        param: { groupId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to extract group"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { groupId, sessionId }) => {
      // Only cache invalidation - UI concerns (toast, navigation) handled in component
      queryClient.invalidateQueries({
        queryKey: extractionKeys.result(groupId),
      });
      // Invalidate group list since group status changes
      queryClient.invalidateQueries({
        queryKey: groupKeys.listBySession(sessionId),
      });
    },
  });
}
