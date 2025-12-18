"use client";

import { useRef, useState } from "react";
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
import { useCreateGroupWithImages } from "@/hooks/groups";

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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

interface CaptureCardProps {
  sessionId: string;
  onCancel: () => void;
  /** Called when upload completes, provides groupId for extraction */
  onStarted: (groupId: string) => void;
  /** Called when upload fails */
  onComplete: () => void;
}

export function CaptureCard({
  sessionId,
  onCancel,
  onStarted,
  onComplete,
}: CaptureCardProps) {
  const [images, setImages] = useState<LocalImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const createGroupWithImages = useCreateGroupWithImages();

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

  const handleSubmit = async () => {
    if (images.length === 0) {
      toast.error("Add at least one image");
      return;
    }

    setIsUploading(true);

    // Convert images to base64 with dimensions for API
    const imageData = await Promise.all(
      images.map(async (img) => {
        const [base64, dimensions] = await Promise.all([
          fileToBase64(img.file),
          getImageDimensions(img.file),
        ]);
        return {
          name: img.file.name,
          type: img.file.type,
          base64,
          width: dimensions.width,
          height: dimensions.height,
        };
      })
    );

    // Cleanup previews
    images.forEach((img) => URL.revokeObjectURL(img.preview));

    // Use mutation with callbacks for UI concerns
    createGroupWithImages.mutate(
      { sessionId, images: imageData },
      {
        onSuccess: async (data) => {
          const groupId = data.group?.id;
          if (!groupId) {
            toast.error("Failed to create group");
            setIsUploading(false);
            return;
          }

          // Notify parent - extraction will be handled by parent
          setImages([]);
          setIsUploading(false);
          onStarted(groupId);
        },
        onError: (error) => {
          toast.error(error.message);
          setIsUploading(false);
          onComplete();
        },
      }
    );
  };

  const isProcessing = isUploading || createGroupWithImages.isPending;

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
                  disabled={isProcessing}
                  className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
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
            disabled={isProcessing}
          />
          <Button
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
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
            disabled={isProcessing}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload className="size-4 mr-2" />
            Upload
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || images.length === 0}
        >
          {isUploading ? (
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
