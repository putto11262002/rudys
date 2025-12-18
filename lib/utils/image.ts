/**
 * Shared image utilities for file validation and processing.
 * Used by both loading list capture and station capture.
 */

// Upload constraints (from spec Constraints §1)
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE_MB = 5;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Validates an image file against upload constraints.
 * @returns Error message if invalid, null if valid
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Unsupported file type (use JPEG, PNG, or WebP)";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large (max ${MAX_FILE_SIZE_MB}MB)`;
  }
  return null;
}

/**
 * Converts a File to base64 string (without data URL prefix)
 */
export async function fileToBase64(file: File): Promise<string> {
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

/**
 * Gets image dimensions from a File
 */
export async function getImageDimensions(
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
 * Gets file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return mimeToExt[mimeType] || "jpg";
}

/**
 * Prepares an image file for upload (validates, converts to base64, gets dimensions)
 */
export async function prepareImageForUpload(file: File): Promise<
  | {
      ok: true;
      data: {
        name: string;
        type: string;
        base64: string;
        width: number;
        height: number;
      };
    }
  | { ok: false; error: string }
> {
  const validationError = validateImageFile(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  try {
    const [base64, dimensions] = await Promise.all([
      fileToBase64(file),
      getImageDimensions(file),
    ]);

    return {
      ok: true,
      data: {
        name: file.name,
        type: file.type,
        base64,
        width: dimensions.width,
        height: dimensions.height,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to process image",
    };
  }
}
