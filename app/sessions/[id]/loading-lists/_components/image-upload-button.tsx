"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  uploadLoadingListImage,
  validateImageForUpload,
} from "@/lib/blob/upload";

interface ImageUploadButtonProps {
  sessionId: string;
  groupId: string;
}

export function ImageUploadButton({
  sessionId,
  groupId,
}: ImageUploadButtonProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const totalFiles = files.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${i + 1} of ${totalFiles}...`);

      // Validate first
      const validation = await validateImageForUpload(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.message}`);
        failCount++;
        continue;
      }

      // Upload
      const result = await uploadLoadingListImage({
        file,
        sessionId,
        groupId,
        captureType: "uploaded_file",
      });

      if (result.ok) {
        successCount++;
      } else {
        toast.error(`${file.name}: ${result.error}`);
        failCount++;
      }
    }

    setIsUploading(false);
    setUploadProgress("");

    if (successCount > 0) {
      toast.success(`${successCount} image${successCount > 1 ? "s" : ""} uploaded`);
      router.refresh();
    }

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleCameraCapture = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress("Uploading...");

    // Validate
    const validation = await validateImageForUpload(file);
    if (!validation.valid) {
      toast.error(validation.message);
      setIsUploading(false);
      setUploadProgress("");
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      return;
    }

    // Upload
    const result = await uploadLoadingListImage({
      file,
      sessionId,
      groupId,
      captureType: "camera_photo",
    });

    setIsUploading(false);
    setUploadProgress("");

    if (result.ok) {
      toast.success("Image captured and uploaded");
      router.refresh();
    } else {
      toast.error(result.error);
    }

    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="flex gap-2">
      {/* Camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => cameraInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Camera className="size-4 mr-2" />
        )}
        Camera
      </Button>

      {/* File upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            {uploadProgress}
          </>
        ) : (
          <>
            <Upload className="size-4 mr-2" />
            Upload
          </>
        )}
      </Button>
    </div>
  );
}
