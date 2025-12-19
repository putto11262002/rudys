"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { MultiImageCapture } from "@/components/ui/multi-image-capture";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { useCreatePendingGroup, useUploadGroupImages } from "@/hooks/groups";

interface LoadingListCaptureFormProps {
  sessionId: string;
  /**
   * Called when upload completes and group is ready for extraction.
   * Uses streaming extraction in parent for real-time UI updates.
   * @param imageUrls - Blob URLs from client upload (passed directly to extraction)
   */
  onUploadComplete: (groupId: string, modelId: string, imageUrls: string[]) => void;
}

export function LoadingListCaptureForm({
  sessionId,
  onUploadComplete,
}: LoadingListCaptureFormProps) {
  const [images, setImages] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const createPendingGroup = useCreatePendingGroup();
  const uploadGroupImages = useUploadGroupImages();

  const handleSubmit = async (modelId: string) => {
    if (images.length === 0) {
      toast.error("Add at least one image");
      return;
    }

    setIsCreating(true);

    try {
      // Phase 1: Create group instantly (returns immediately)
      const result = await createPendingGroup.mutateAsync({
        sessionId,
        imageCount: images.length,
      });

      const groupId = result.group?.id;
      if (!groupId) {
        toast.error("Failed to create group");
        setIsCreating(false);
        return;
      }

      // Store images for background upload
      const imagesToUpload = [...images];

      // Clear form immediately - ready for next capture
      setImages([]);
      setIsCreating(false);

      toast.success("Group created, uploading images...");

      // Phase 2: Upload images in background (non-blocking)
      // Capture modelId in closure - no ref needed
      void (async () => {
        try {
          // Upload images via client upload - returns blob URLs
          const result = await uploadGroupImages.mutateAsync({
            groupId,
            sessionId,
            images: imagesToUpload,
          });

          // Extract image URLs from upload result
          const imageUrls = result.uploadResults.map((r) => r.url);

          // Upload complete - trigger extraction with URLs (no DB lookup needed)
          onUploadComplete(groupId, modelId, imageUrls);
        } catch (error) {
          toast.error(
            `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      })();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create group"
      );
      setIsCreating(false);
    }
  };

  const isProcessing = isCreating || createPendingGroup.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <AiActionButton
          onAction={handleSubmit}
          disabled={isProcessing || images.length === 0}
          isLoading={isProcessing}
          label="Confirm & Extract"
          loadingLabel="Creating..."
          icon={<Upload className="size-4" />}
        />
      </div>
      <MultiImageCapture
        value={images}
        onChange={setImages}
        disabled={isProcessing}
      />
    </div>
  );
}
