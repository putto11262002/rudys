"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { demandKeys } from "./query-keys";
import { sessionKeys } from "../sessions";

// ============================================================================
// Queries
// ============================================================================

export function useDemand(sessionId: string) {
  return useQuery({
    queryKey: demandKeys.bySession(sessionId),
    queryFn: async () => {
      const res = await client.api.sessions[":sessionId"].demand.$get({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to fetch demand");
      }
      return res.json();
    },
    enabled: !!sessionId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useApproveDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await client.api.sessions[":sessionId"].demand.approve.$post({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to approve demand");
      }
      return res.json();
    },
    onSuccess: (_data, sessionId) => {
      // Invalidate demand and session queries
      queryClient.invalidateQueries({ queryKey: demandKeys.bySession(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}
