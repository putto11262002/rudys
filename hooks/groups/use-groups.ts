"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { groupKeys } from "./query-keys";
import { sessionKeys } from "../sessions";
import { demandKeys } from "../demand/query-keys";
import { orderKeys } from "../order/query-keys";

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

/**
 * Phase 1: Create a pending group with "uploading" status (instant)
 * Returns immediately with groupId, form can clear and user can add next item
 */
export function useCreatePendingGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      imageCount,
    }: {
      sessionId: string;
      imageCount: number;
    }) => {
      const res = await client.api.sessions[":sessionId"].groups["create-pending"].$post({
        param: { sessionId },
        json: { imageCount },
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
      // Invalidate to show the new "uploading" group in the list
      queryClient.invalidateQueries({
        queryKey: groupKeys.listBySession(sessionId),
      });
    },
  });
}

/**
 * Helper to get image dimensions from a File
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Phase 2: Upload images to an existing group (can run in background)
 * Updates group status from "uploading" to "pending" when complete
 * Uses FormData for efficient file upload (avoids base64 bloat)
 */
export function useUploadGroupImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      sessionId,
      images,
    }: {
      groupId: string;
      sessionId: string;
      images: File[];
    }) => {
      // Get dimensions for all images first
      const dimensions = await Promise.all(images.map(getImageDimensions));

      // Use FormData for efficient file upload
      const formData = new FormData();
      images.forEach((file, index) => {
        formData.append(`image_${index}`, file);
        formData.append(`width_${index}`, dimensions[index].width.toString());
        formData.append(`height_${index}`, dimensions[index].height.toString());
      });

      const res = await fetch(`/api/groups/${groupId}/upload-images`, {
        method: "POST",
        body: formData,
        // Don't set Content-Type - browser sets it automatically with boundary
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
      // Invalidate to update the group's status and images
      queryClient.invalidateQueries({
        queryKey: groupKeys.listBySession(sessionId),
      });
    },
  });
}

/**
 * Legacy: Create group with images in one request (blocks until upload complete)
 * @deprecated Use useCreatePendingGroup + useUploadGroupImages for better UX
 */
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
      // Invalidate demand and order since they depend on groups
      queryClient.invalidateQueries({
        queryKey: demandKeys.bySession(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.bySession(sessionId),
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
      // Invalidate demand and order since they depend on groups
      queryClient.invalidateQueries({
        queryKey: demandKeys.bySession(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.bySession(sessionId),
      });
    },
  });
}
