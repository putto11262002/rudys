import type {
  EmployeeCaptureGroup,
  LoadingListImage,
  LoadingListExtractionResult,
} from "@/lib/db/schema";

/**
 * Group with related images and extraction result
 * This matches the shape returned by the API
 */
export type GroupWithImages = EmployeeCaptureGroup & {
  images: LoadingListImage[];
  extractionResult: LoadingListExtractionResult | null;
};
