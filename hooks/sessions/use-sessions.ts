"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { sessionKeys } from "./query-keys";
import type { sessionPhase } from "@/lib/db/schema";

// ============================================================================
// Queries
// ============================================================================

export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.lists(),
    queryFn: async () => {
      const res = await client.api.sessions.$get();
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to fetch sessions");
      }
      return res.json();
    },
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: sessionKeys.detail(id),
    queryFn: async () => {
      const res = await client.api.sessions[":id"].$get({ param: { id } });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to fetch session");
      }
      return res.json();
    },
    enabled: !!id,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.sessions.$post();
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to create session");
      }
      return res.json();
    },
    onSuccess: () => {
      // Only cache invalidation - UI concerns (toast, navigation) handled in component
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.sessions[":id"].$delete({ param: { id } });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to delete session");
      }
      return res.json();
    },
    onSuccess: (_data, id) => {
      // Invalidate lists and remove the specific session from cache
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      queryClient.removeQueries({ queryKey: sessionKeys.detail(id) });
    },
  });
}

export function useUpdatePhase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      lastPhase,
    }: {
      id: string;
      lastPhase: (typeof sessionPhase)[number];
    }) => {
      const res = await client.api.sessions[":id"].phase.$patch({
        param: { id },
        json: { lastPhase },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to update session phase");
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      // Invalidate both lists and the specific session
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(id) });
    },
  });
}
