import type {
  EmployeeCaptureGroup,
  LoadingListImage,
  LoadingListExtraction,
  LoadingListItem,
} from "@/lib/db/schema";

/**
 * Group with related images, extraction, and items
 * This matches the shape returned by the API
 */
export type GroupWithImages = EmployeeCaptureGroup & {
  images: LoadingListImage[];
  extraction: LoadingListExtraction | null;
  items: LoadingListItem[];
};
