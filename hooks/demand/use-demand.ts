"use client";

import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { demandKeys } from "./query-keys";

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
