import type {
  StationCapture,
  LoadingListItem,
  LoadingListExtraction,
} from "@/lib/db/schema";

// ============================================================================
// Types
// ============================================================================

export type ComputedDemandItem = {
  productCode: string;
  demandQty: number;
  description?: string | null; // From AI extraction
  sources: Array<{
    groupId: string;
    employeeLabel: string | null;
    activityCode: string;
  }>;
};

export type ComputedOrderItem = {
  productCode: string;
  productDescription?: string | null; // From AI extraction
  demandQty: number;
  onHandQty: number;
  minQty: number | null;
  maxQty: number | null;
  recommendedOrderQty: number;
  exceedsMax: boolean;
  isCaptured: boolean; // Derived: true if station exists with images
};

export type SkippedOrderItem = {
  productCode: string;
  demandQty: number;
  reason: "no_station" | "station_invalid" | "missing_data";
};

export type CoverageInfo = {
  covered: string[];
  missing: string[];
  percentage: number;
  isComplete: boolean;
};

export type ExtractionStats = {
  totalGroups: number;
  extractedGroups: number;
  errorGroups: number;
  warningGroups: number;
  totalActivities: number;
  totalItems: number;
  totalCost: number;
};

// ============================================================================
// Group type for computation (new schema)
// ============================================================================

export type GroupForComputation = {
  id: string;
  employeeLabel: string | null;
  extraction: {
    status: string;
    rawActivities: Array<{ activityCode: string }>;
    summary: {
      totalActivities: number;
      totalLineItems: number;
    };
    totalCost: number | null;
  } | null;
  items: Array<{
    productCode: string;
    quantity: number;
    activityCode: string;
    description: string | null;
  }>;
};

// ============================================================================
// Demand Computation (reads from extracted items)
// ============================================================================

/**
 * Compute demand from extracted loading list items.
 * All extracted items are included - no catalog validation.
 */
export function computeDemandFromGroups(
  groups: GroupForComputation[]
): ComputedDemandItem[] {
  const demandMap = new Map<string, ComputedDemandItem>();

  for (const group of groups) {
    // Skip groups without extraction or with error status
    if (!group.extraction) continue;
    if (group.extraction.status === "error") continue;

    // Process all extracted items
    for (const item of group.items) {
      // Skip invalid quantity
      if (typeof item.quantity !== "number" || item.quantity <= 0) continue;

      const existing = demandMap.get(item.productCode);

      if (existing) {
        existing.demandQty += item.quantity;
        existing.sources.push({
          groupId: group.id,
          employeeLabel: group.employeeLabel,
          activityCode: item.activityCode,
        });
        // Keep first non-null description encountered
        if (!existing.description && item.description) {
          existing.description = item.description;
        }
      } else {
        demandMap.set(item.productCode, {
          productCode: item.productCode,
          demandQty: item.quantity,
          description: item.description, // From AI extraction
          sources: [
            {
              groupId: group.id,
              employeeLabel: group.employeeLabel,
              activityCode: item.activityCode,
            },
          ],
        });
      }
    }
  }

  return Array.from(demandMap.values()).sort((a, b) =>
    a.productCode.localeCompare(b.productCode)
  );
}

// ============================================================================
// Order Computation
// ============================================================================

/**
 * Compute order items from demand and station captures.
 *
 * For products WITH station capture: use actual on-hand, min, max from station
 * For products WITHOUT station capture: assume on-hand=0, min=0, max=demand
 *   (pessimistic defaults - order exactly what's demanded)
 */
export function computeOrderItems(
  demandItems: ComputedDemandItem[],
  stations: StationCapture[]
): { computed: ComputedOrderItem[]; skipped: SkippedOrderItem[] } {
  const computed: ComputedOrderItem[] = [];
  const skipped: SkippedOrderItem[] = [];

  for (const demand of demandItems) {
    // Find station for this product
    const station = stations.find((s) => s.productCode === demand.productCode);

    // isCaptured: station exists with valid data
    const isCaptured = !!(
      station?.signBlobUrl &&
      station?.stockBlobUrl &&
      station.status === "valid" &&
      station.onHandQty !== null &&
      station.maxQty !== null
    );

    if (isCaptured) {
      // Use actual station data
      const onHandQty = station.onHandQty!;
      const maxQty = station.maxQty!;
      const recommendedOrderQty = Math.max(0, demand.demandQty - onHandQty);
      const exceedsMax = onHandQty + recommendedOrderQty > maxQty;

      computed.push({
        productCode: demand.productCode,
        productDescription: demand.description,
        demandQty: demand.demandQty,
        onHandQty,
        minQty: station.minQty,
        maxQty,
        recommendedOrderQty,
        exceedsMax,
        isCaptured: true,
      });
    } else {
      // No station capture - use pessimistic defaults
      // Assume nothing on hand, order exactly what's demanded
      const onHandQty = 0;
      const minQty = 0;
      const maxQty = demand.demandQty; // Max = demand (no buffer)
      const recommendedOrderQty = demand.demandQty; // Order full demand

      computed.push({
        productCode: demand.productCode,
        productDescription: demand.description,
        demandQty: demand.demandQty,
        onHandQty,
        minQty,
        maxQty,
        recommendedOrderQty,
        exceedsMax: false, // Can't exceed max when max = demand
        isCaptured: false,
      });
    }
  }

  computed.sort((a, b) => a.productCode.localeCompare(b.productCode));
  skipped.sort((a, b) => a.productCode.localeCompare(b.productCode));

  return { computed, skipped };
}

// ============================================================================
// Coverage Computation
// ============================================================================

/**
 * Compute station capture coverage for demanded products.
 *
 * Coverage indicates how many products have actual station data vs using defaults.
 * All products can now be computed (missing stations use pessimistic defaults),
 * but coverage percentage shows data quality.
 *
 * - covered: products with valid station captures (accurate on-hand data)
 * - missing: products using defaults (on-hand=0, max=demand)
 * - isComplete: true when all products have station captures (100% coverage)
 */
export function computeCoverage(
  demandItems: ComputedDemandItem[],
  stations: StationCapture[]
): CoverageInfo {
  const demandedProducts = demandItems.map((d) => d.productCode);
  const validStationProducts = stations
    .filter((s) => s.status === "valid" && s.onHandQty !== null && s.maxQty !== null)
    .map((s) => s.productCode)
    .filter((p): p is string => p !== null);

  // Products with station captures (accurate data)
  const covered = demandedProducts.filter((p) =>
    validStationProducts.includes(p)
  );
  // Products using defaults (no station capture)
  const missing = demandedProducts.filter(
    (p) => !validStationProducts.includes(p)
  );

  // Percentage represents station capture coverage (data quality metric)
  const percentage =
    demandedProducts.length > 0
      ? Math.round((covered.length / demandedProducts.length) * 100)
      : 100;

  return {
    covered,
    missing,
    percentage,
    isComplete: missing.length === 0,
  };
}

// ============================================================================
// Extraction Stats
// ============================================================================

export function computeExtractionStats(
  groups: GroupForComputation[]
): ExtractionStats {
  let extractedGroups = 0;
  let errorGroups = 0;
  let warningGroups = 0;
  let totalActivities = 0;
  let totalItems = 0;
  let totalCost = 0;

  for (const group of groups) {
    if (!group.extraction) continue;

    if (group.extraction.status === "error") {
      errorGroups++;
    } else if (group.extraction.status === "warning") {
      warningGroups++;
      extractedGroups++;
      totalActivities += group.extraction.summary.totalActivities;
      totalItems += group.items.length;
      totalCost += group.extraction.totalCost ?? 0;
    } else {
      extractedGroups++;
      totalActivities += group.extraction.summary.totalActivities;
      totalItems += group.items.length;
      totalCost += group.extraction.totalCost ?? 0;
    }
  }

  return {
    totalGroups: groups.length,
    extractedGroups,
    errorGroups,
    warningGroups,
    totalActivities,
    totalItems,
    totalCost,
  };
}
