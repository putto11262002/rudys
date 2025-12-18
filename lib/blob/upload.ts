import { upload } from "@vercel/blob/client";
import { type PutBlobResult } from "@vercel/blob";

// Constraints §1: Upload constraints
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const REQUIRE_PORTRAIT = true;

export type UploadValidationError =
  | "not_portrait"
  | "file_too_large"
  | "unsupported_type";

export interface UploadValidationResult {
  valid: boolean;
  error?: UploadValidationError;
  message?: string;
  width?: number;
  height?: number;
}

/**
 * Get image dimensions from a File object
 */
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

/**
 * Validate an image file for upload per Constraints §1
 * - Allowed MIME types: image/jpeg, image/png, image/webp
 * - Max file size: 10MB
 * - Orientation: must be portrait (height > width)
 */
export async function validateImageForUpload(
  file: File
): Promise<UploadValidationResult> {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "unsupported_type",
      message: "Unsupported type",
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "file_too_large", message: "File too large" };
  }

  // Check orientation (requires loading image)
  const dimensions = await getImageDimensions(file);

  if (REQUIRE_PORTRAIT && dimensions.width >= dimensions.height) {
    return { valid: false, error: "not_portrait", message: "Not portrait" };
  }

  return { valid: true, width: dimensions.width, height: dimensions.height };
}

export interface UploadImageParams {
  file: File;
  sessionId: string;
  groupId: string;
  captureType: "camera_photo" | "uploaded_file";
}

export interface UploadSuccessResult {
  ok: true;
  data: PutBlobResult;
  imageId: string;
}

export interface UploadErrorResult {
  ok: false;
  error: string;
}

export type UploadResult = UploadSuccessResult | UploadErrorResult;

/**
 * Upload a loading list image to Vercel Blob
 * - Validates the file first (client-side gate per Constraints §1)
 * - Uploads to /api/blob/upload with metadata
 * - Returns the blob result or an error
 */
export async function uploadLoadingListImage(
  params: UploadImageParams
): Promise<UploadResult> {
  const { file, sessionId, groupId, captureType } = params;

  // Validate first
  const validation = await validateImageForUpload(file);
  if (!validation.valid) {
    return { ok: false, error: validation.message! };
  }

  // Generate unique image ID
  const imageId = crypto.randomUUID();

  try {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/blob/upload",
      clientPayload: JSON.stringify({
        sessionId,
        groupId,
        imageId,
        width: validation.width,
        height: validation.height,
        captureType,
      }),
    });

    return { ok: true, data: blob, imageId };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
