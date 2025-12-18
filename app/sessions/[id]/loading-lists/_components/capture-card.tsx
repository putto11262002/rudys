"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createEmployeeGroup,
  uploadGroupImage,
  finalizeGroup,
} from "@/lib/actions/groups";

// Constraints
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface LocalImage {
  id: string;
  file: File;
  preview: string;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Unsupported file type";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large (max ${MAX_FILE_SIZE_MB}MB)`;
  }
  return null;
}

interface CaptureCardProps {
  sessionId: string;
  onCancel: () => void;
  onComplete: () => void;
}

export function CaptureCard({
  sessionId,
  onCancel,
  onComplete,
}: CaptureCardProps) {
  const [images, setImages] = useState<LocalImage[]>([]);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;

    const newImages: LocalImage[] = [];
    for (const file of Array.from(files)) {
      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }
      newImages.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setImages((prev) => [...prev, ...newImages]);

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleSubmit = () => {
    if (images.length === 0) {
      toast.error("Add at least one image");
      return;
    }

    startTransition(async () => {
      // 1. Create the group
      const groupResult = await createEmployeeGroup(sessionId);
      if (!groupResult.ok) {
        toast.error(groupResult.error);
        return;
      }

      const { groupId } = groupResult.data;

      // 2. Upload each image in parallel (separate server action calls)
      const uploadResults = await Promise.all(
        images.map(async (img, index) => {
          const formData = new FormData();
          formData.append("image", img.file);
          return uploadGroupImage(groupId, sessionId, index, formData);
        })
      );

      const successCount = uploadResults.filter((r) => r.ok).length;
      const failCount = uploadResults.length - successCount;

      // 3. Finalize (revalidate cache)
      await finalizeGroup(sessionId);

      // Cleanup previews
      images.forEach((img) => URL.revokeObjectURL(img.preview));

      if (failCount > 0) {
        toast.warning(`${successCount} uploaded, ${failCount} failed`);
      } else {
        toast.success(`${successCount} image${successCount !== 1 ? "s" : ""} uploaded`);
      }

      onComplete();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="size-5" />
          Capture Loading Lists
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image previews */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden group"
              >
                <img
                  src={img.preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {images.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="size-12 mx-auto mb-2 opacity-50" />
            <p>No images yet</p>
            <p className="text-sm">Use the buttons below to add images</p>
          </div>
        )}

        {/* Upload buttons */}
        <div className="flex gap-2">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            disabled={isPending}
          />
          <Button
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isPending}
          >
            <Camera className="size-4 mr-2" />
            Camera
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            disabled={isPending}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="size-4 mr-2" />
            Upload
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isPending || images.length === 0}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            "Confirm"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
