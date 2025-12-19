"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { MultiImageCapture } from "@/components/ui/multi-image-capture";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { useCreateGroupWithImages } from "@/hooks/groups";
import { fileToBase64, getImageDimensions } from "@/lib/utils/image";

interface LoadingListCaptureFormProps {
  sessionId: string;
  /** Called when upload completes, provides groupId for extraction */
  onStarted: (groupId: string, modelId: string) => void;
}

export function LoadingListCaptureForm({
  sessionId,
  onStarted,
}: LoadingListCaptureFormProps) {
  const [images, setImages] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const createGroupWithImages = useCreateGroupWithImages();

  const handleSubmit = async (modelId: string) => {
    if (images.length === 0) {
      toast.error("Add at least one image");
      return;
    }

    setIsUploading(true);

    try {
      // Convert images to base64 with dimensions for API
      const imageData = await Promise.all(
        images.map(async (file) => {
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

      // Use mutation with callbacks for UI concerns
      createGroupWithImages.mutate(
        { sessionId, images: imageData },
        {
          onSuccess: (data) => {
            const groupId = data.group?.id;
            if (!groupId) {
              toast.error("Failed to create group");
              setIsUploading(false);
              return;
            }

            // Clear form immediately - ready for next capture
            setImages([]);
            setIsUploading(false);

            // Notify parent - extraction will be handled by parent
            onStarted(groupId, modelId);
          },
          onError: (error) => {
            toast.error(error.message);
            setIsUploading(false);
          },
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process images"
      );
      setIsUploading(false);
    }
  };

  const isProcessing = isUploading || createGroupWithImages.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-start sm:justify-end">
        <AiActionButton
          onAction={handleSubmit}
          disabled={isProcessing || images.length === 0}
          isLoading={isProcessing}
          label="Confirm & Extract"
          loadingLabel="Uploading..."
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
