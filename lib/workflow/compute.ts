import type { StationCapture } from "@/lib/db/schema";

// ============================================================================
// Types
// ============================================================================

export type ComputedDemandItem = {
  productCode: string;
  demandQty: number;
  description?: string;
  sources: Array<{
    groupId: string;
    employeeLabel: string | null;
    activityCode: string;
  }>;
};

export type ComputedOrderItem = {
  productCode: string;
  demandQty: number;
  onHandQty: number;
  minQty: number | null;
  maxQty: number | null;
  recommendedOrderQty: number;
  exceedsMax: boolean;
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
  totalActivities: number;
  totalLineItems: number;
  totalCost: number;
};

// ============================================================================
// Group type for computation (subset of full group)
// ============================================================================

export type GroupForComputation = {
  id: string;
  employeeLabel: string | null;
  extractionResult: {
    status: string;
    lineItems: Array<{
      primaryCode: string;
      quantity: number;
      description?: string;
      activityCode: string;
    }>;
    summary: {
      totalActivities: number;
      totalLineItems: number;
    };
    totalCost: number | null;
  } | null;
};

// ============================================================================
// Demand Computation
// ============================================================================

export function computeDemandFromGroups(
  groups: GroupForComputation[]
): ComputedDemandItem[] {
  const demandMap = new Map<string, ComputedDemandItem>();

  for (const group of groups) {
    // Filter: no extraction result
    if (!group.extractionResult) continue;

    // Filter: extraction failed
    if (group.extractionResult.status === "error") continue;

    for (const lineItem of group.extractionResult.lineItems) {
      // Filter: missing product code
      if (!lineItem.primaryCode) continue;

      // Filter: invalid quantity
      if (typeof lineItem.quantity !== "number" || lineItem.quantity <= 0)
        continue;

      const existing = demandMap.get(lineItem.primaryCode);
      if (existing) {
        existing.demandQty += lineItem.quantity;
        existing.sources.push({
          groupId: group.id,
          employeeLabel: group.employeeLabel,
          activityCode: lineItem.activityCode,
        });
      } else {
        demandMap.set(lineItem.primaryCode, {
          productCode: lineItem.primaryCode,
          demandQty: lineItem.quantity,
          description: lineItem.description,
          sources: [
            {
              groupId: group.id,
              employeeLabel: group.employeeLabel,
              activityCode: lineItem.activityCode,
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

export function computeOrderItems(
  demandItems: ComputedDemandItem[],
  stations: StationCapture[]
): { computed: ComputedOrderItem[]; skipped: SkippedOrderItem[] } {
  const computed: ComputedOrderItem[] = [];
  const skipped: SkippedOrderItem[] = [];

  for (const demand of demandItems) {
    // Find station for this product
    const station = stations.find((s) => s.productCode === demand.productCode);

    if (!station) {
      skipped.push({
        productCode: demand.productCode,
        demandQty: demand.demandQty,
        reason: "no_station",
      });
      continue;
    }

    if (station.status !== "valid") {
      skipped.push({
        productCode: demand.productCode,
        demandQty: demand.demandQty,
        reason: "station_invalid",
      });
      continue;
    }

    if (station.onHandQty === null || station.maxQty === null) {
      skipped.push({
        productCode: demand.productCode,
        demandQty: demand.demandQty,
        reason: "missing_data",
      });
      continue;
    }

    const onHandQty = station.onHandQty;
    const maxQty = station.maxQty;
    const recommendedOrderQty = Math.max(0, demand.demandQty - onHandQty);
    const exceedsMax = onHandQty + recommendedOrderQty > maxQty;

    computed.push({
      productCode: demand.productCode,
      demandQty: demand.demandQty,
      onHandQty,
      minQty: station.minQty,
      maxQty,
      recommendedOrderQty,
      exceedsMax,
    });
  }

  computed.sort((a, b) => a.productCode.localeCompare(b.productCode));
  skipped.sort((a, b) => a.productCode.localeCompare(b.productCode));

  return { computed, skipped };
}

// ============================================================================
// Coverage Computation
// ============================================================================

export function computeCoverage(
  demandItems: ComputedDemandItem[],
  stations: StationCapture[]
): CoverageInfo {
  const demandedProducts = demandItems.map((d) => d.productCode);
  const validStationProducts = stations
    .filter((s) => s.status === "valid" && s.onHandQty !== null)
    .map((s) => s.productCode)
    .filter((p): p is string => p !== null);

  const covered = demandedProducts.filter((p) =>
    validStationProducts.includes(p)
  );
  const missing = demandedProducts.filter(
    (p) => !validStationProducts.includes(p)
  );
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
  let totalActivities = 0;
  let totalLineItems = 0;
  let totalCost = 0;

  for (const group of groups) {
    if (!group.extractionResult) continue;

    if (group.extractionResult.status === "error") {
      errorGroups++;
    } else {
      extractedGroups++;
      totalActivities += group.extractionResult.summary.totalActivities;
      totalLineItems += group.extractionResult.summary.totalLineItems;
      totalCost += group.extractionResult.totalCost ?? 0;
    }
  }

  return {
    totalGroups: groups.length,
    extractedGroups,
    errorGroups,
    totalActivities,
    totalLineItems,
    totalCost,
  };
}
