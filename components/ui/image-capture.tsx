"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, X } from "lucide-react";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/utils/image";

interface ImageCaptureProps {
  /** Current image file */
  value: File | null;
  /** Callback when image changes */
  onChange: (file: File | null) => void;
  /** Label shown above the input */
  label?: string;
  /** Disable all interactions */
  disabled?: boolean;
  /** Fixed height for both preview and upload box (default: 120px) */
  height?: number;
  /** Accepted file types for file picker (default: image/jpeg,image/png,image/webp) */
  accept?: string;
  /** Alt text for preview image */
  alt?: string;
}

export function ImageCapture({
  value,
  onChange,
  label,
  disabled = false,
  height = 120,
  accept = "image/jpeg,image/png,image/webp",
  alt = "Preview",
}: ImageCaptureProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manage preview URL lifecycle
  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [value]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    onChange(file);

    // Reset inputs
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
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
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      {previewUrl ? (
        <div className="flex items-center" style={{ height }}>
          <div className="relative">
            <img
              src={previewUrl}
              alt={alt}
              className="w-auto object-contain rounded-lg"
              style={{ maxHeight: height }}
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="border rounded-lg overflow-hidden"
          style={{ height }}
        >
          <div className="grid grid-cols-2 divide-x h-full">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={disabled}
              className="flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <Camera className="size-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              className="flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <ImageUp className="size-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Upload</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
