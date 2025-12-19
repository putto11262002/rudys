"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { MultiImageCapture } from "@/components/ui/multi-image-capture";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { useCreatePendingGroup, useUploadGroupImages } from "@/hooks/groups";
import { fileToBase64, getImageDimensions } from "@/lib/utils/image";

interface LoadingListCaptureFormProps {
  sessionId: string;
  /**
   * Called when upload completes and group is ready for extraction.
   * Uses streaming extraction in parent for real-time UI updates.
   */
  onUploadComplete: (groupId: string, modelId: string) => void;
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
          // Convert images to base64
          const imageData = await Promise.all(
            imagesToUpload.map(async (file) => {
              const [base64, dimensions] = await Promise.all([
                fileToBase64(file),
                getImageDimensions(file),
              ]);
              return {
                name: file.name,
                type: file.type,
                base64,
                width: dimensions.width,
                height: dimensions.height,
              };
            })
          );

          // Upload images
          await uploadGroupImages.mutateAsync({
            groupId,
            sessionId,
            images: imageData,
          });

          // Upload complete - trigger extraction via parent (streaming)
          onUploadComplete(groupId, modelId);
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
