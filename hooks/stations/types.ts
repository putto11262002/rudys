import type { StationCapture } from "@/lib/db/schema";

/**
 * Station with all fields populated
 */
export type StationWithDetails = StationCapture;

/**
 * Coverage item for a demanded product
 */
export type CoverageItem = {
  productCode: string;
  demandQty: number;
  hasValidStation: boolean;
  stationId?: string;
  onHandQty?: number | null;
  minQty?: number | null;
  maxQty?: number | null;
};

/**
 * Coverage summary for a session
 */
export type CoverageSummary = {
  canProceed: boolean;
  coveredCount: number;
  totalCount: number;
  percentage: number;
};

/**
 * Full coverage response
 */
export type CoverageResponse = {
  coverage: CoverageItem[];
  summary: CoverageSummary;
};
