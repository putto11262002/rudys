"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, X } from "lucide-react";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/utils/image";

interface PreviewImage {
  id: string;
  file: File;
  url: string;
}

interface MultiImageCaptureProps {
  /** Current image files */
  value: File[];
  /** Callback when images change */
  onChange: (files: File[]) => void;
  /** Label shown above the input */
  label?: string;
  /** Disable all interactions */
  disabled?: boolean;
  /** Fixed height for preview images (default: 120px) */
  height?: number;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Accepted file types for file picker (default: image/jpeg,image/png,image/webp) */
  accept?: string;
}

export function MultiImageCapture({
  value,
  onChange,
  label,
  disabled = false,
  height = 120,
  maxImages,
  accept = "image/jpeg,image/png,image/webp",
}: MultiImageCaptureProps) {
  const [previews, setPreviews] = useState<PreviewImage[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync previews with value prop - use file reference for matching
  useEffect(() => {
    // Create new previews for files that don't have one
    const newPreviews: PreviewImage[] = value.map((file) => {
      // Check if we already have a preview for this exact file reference
      const existing = previews.find((p) => p.file === file);
      if (existing) {
        return existing;
      }
      // Create new preview with unique ID
      return {
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      };
    });

    // Revoke URLs for previews that are no longer needed
    previews.forEach((preview) => {
      const stillExists = newPreviews.some((p) => p.id === preview.id);
      if (!stillExists) {
        URL.revokeObjectURL(preview.url);
      }
    });

    setPreviews(newPreviews);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const currentCount = value.length;

    for (const file of Array.from(files)) {
      // Check max images limit
      if (maxImages && currentCount + newFiles.length >= maxImages) {
        toast.error(`Maximum ${maxImages} images allowed`);
        break;
      }

      const error = validateImageFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      onChange([...value, ...newFiles]);
    }

    // Reset inputs
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemove = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  const hasImages = value.length > 0;
  const canAddMore = !maxImages || value.length < maxImages;

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium">{label}</p>}

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      {/* Capture buttons - always visible */}
      <div
        className="border rounded-lg overflow-hidden"
        style={{ height }}
      >
        <div className="grid grid-cols-2 divide-x h-full">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={disabled || !canAddMore}
            className="flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <Camera className="size-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || !canAddMore}
            className="flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <ImageUp className="size-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload</span>
          </button>
        </div>
      </div>

      {/* Image previews - horizontal scroll */}
      {hasImages && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {previews.map((preview, index) => (
            <div
              key={preview.id}
              className="relative flex-shrink-0"
              style={{ height }}
            >
              <img
                src={preview.url}
                alt={`Preview ${index + 1}`}
                className="h-full w-auto object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="absolute -top-2 -right-2 p-1 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
