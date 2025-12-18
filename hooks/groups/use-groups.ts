"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { groupKeys } from "./query-keys";
import { sessionKeys } from "../sessions";

// ============================================================================
// Queries
// ============================================================================

export function useGroups(sessionId: string) {
  return useQuery({
    queryKey: groupKeys.listBySession(sessionId),
    queryFn: async () => {
      const res = await client.api.sessions[":sessionId"].groups.$get({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to fetch groups");
      }
      return res.json();
    },
    enabled: !!sessionId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateGroupWithImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      images,
    }: {
      sessionId: string;
      images: Array<{
        name: string;
        type: string;
        base64: string;
        width: number;
        height: number;
      }>;
    }) => {
      const res = await client.api.sessions[":sessionId"].groups.$post({
        param: { sessionId },
        json: { images },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to create group"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { sessionId }) => {
      // Only cache invalidation - UI concerns (toast, navigation) handled in component
      queryClient.invalidateQueries({
        queryKey: groupKeys.listBySession(sessionId),
      });
      // Also invalidate session detail since it might show group count
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(sessionId),
      });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; sessionId: string }) => {
      const res = await client.api.groups[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to delete group"
        );
      }
      return res.json();
    },
    onSuccess: (_data, { id, sessionId }) => {
      // Invalidate lists and remove the specific group from cache
      queryClient.invalidateQueries({
        queryKey: groupKeys.listBySession(sessionId),
      });
      queryClient.removeQueries({ queryKey: groupKeys.detail(id) });
      // Also invalidate session detail since it might show group count
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(sessionId),
      });
    },
  });
}
