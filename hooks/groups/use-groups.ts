"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { upload } from "@vercel/blob/client";
import { client } from "@/lib/api/client";
import { groupKeys } from "./query-keys";
import { sessionKeys } from "../sessions";
import { demandKeys } from "../demand/query-keys";
import { orderKeys } from "../order/query-keys";
import type { LoadingListImage, EmployeeCaptureGroup } from "@/lib/db/schema";

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
 * Phase 2: Upload images via Vercel Blob client upload with optimistic updates
 * - Uploads directly to Vercel Blob (bypasses server body limit)
 * - Optimistically updates React Query cache for instant UI
 * - onUploadCompleted webhook persists to DB in background
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

      // Upload all images in parallel via client upload
      const uploadResults = await Promise.all(
        images.map(async (file, index) => {
          const ext = file.name.split(".").pop() || "jpg";
          const pathname = `sessions/${sessionId}/groups/${groupId}/${index}.${ext}`;

          const result = await upload(pathname, file, {
            access: "public",
            handleUploadUrl: "/api/blob/group-images",
            clientPayload: JSON.stringify({
              groupId,
              sessionId,
              index,
              width: dimensions[index].width,
              height: dimensions[index].height,
              totalImages: images.length,
            }),
          });

          return {
            url: result.url,
            index,
            width: dimensions[index].width,
            height: dimensions[index].height,
          };
        })
      );

      return { uploadResults, groupId, sessionId };
    },
    onSuccess: ({ uploadResults, groupId, sessionId }) => {
      // Optimistically update the cache with uploaded images
      queryClient.setQueryData(
        groupKeys.listBySession(sessionId),
        (oldData: { groups: (EmployeeCaptureGroup & { images: LoadingListImage[] })[] } | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            groups: oldData.groups.map((group) => {
              if (group.id !== groupId) return group;

              // Build optimistic images array
              const optimisticImages: Partial<LoadingListImage>[] = uploadResults.map((r) => ({
                id: crypto.randomUUID(), // Temporary ID
                groupId,
                blobUrl: r.url,
                captureType: "uploaded_file" as const,
                orderIndex: r.index,
                width: r.width,
                height: r.height,
                uploadedAt: new Date().toISOString(),
              }));

              return {
                ...group,
                status: "pending" as const,
                images: optimisticImages as LoadingListImage[],
              };
            }),
          };
        }
      );
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
