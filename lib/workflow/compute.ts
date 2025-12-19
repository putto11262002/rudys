import type { StationCapture } from "@/lib/db/schema";
import { getProduct } from "@/lib/products/catalog";

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
  productDescription?: string;
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
    const catalogProduct = getProduct(demand.productCode);

    // isCaptured: station exists with images
    const isCaptured = !!(
      station?.signBlobUrl && station?.stockBlobUrl &&
      station.status === "valid" && station.onHandQty !== null && station.maxQty !== null
    );

    // If we have a captured station, use station data
    if (isCaptured) {
      const onHandQty = station.onHandQty!;
      const maxQty = station.maxQty!;
      const recommendedOrderQty = Math.max(0, demand.demandQty - onHandQty);
      const exceedsMax = onHandQty + recommendedOrderQty > maxQty;

      computed.push({
        productCode: demand.productCode,
        productDescription: catalogProduct?.description,
        demandQty: demand.demandQty,
        onHandQty,
        minQty: station.minQty,
        maxQty,
        recommendedOrderQty,
        exceedsMax,
        isCaptured: true,
      });
      continue;
    }

    // Fall back to catalog if product exists there
    if (catalogProduct) {
      // Catalog fallback: assume onHand = 0 (pessimistic/conservative)
      const onHandQty = 0;
      const maxQty = catalogProduct.maxQty;
      const minQty = catalogProduct.minQty;
      const recommendedOrderQty = Math.max(0, demand.demandQty - onHandQty);
      const exceedsMax = onHandQty + recommendedOrderQty > maxQty;

      computed.push({
        productCode: demand.productCode,
        productDescription: catalogProduct.description,
        demandQty: demand.demandQty,
        onHandQty,
        minQty,
        maxQty,
        recommendedOrderQty,
        exceedsMax,
        isCaptured: false,
      });
      continue;
    }

    // Product not in catalog and no valid station - skip
    skipped.push({
      productCode: demand.productCode,
      demandQty: demand.demandQty,
      reason: station ? (station.status !== "valid" ? "station_invalid" : "missing_data") : "no_station",
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

  // Products are covered if they have a valid station OR exist in catalog
  const covered = demandedProducts.filter(
    (p) => validStationProducts.includes(p) || getProduct(p) !== undefined
  );
  const missing = demandedProducts.filter(
    (p) => !validStationProducts.includes(p) && getProduct(p) === undefined
  );

  // Percentage now represents station capture coverage (not total availability)
  const capturedCount = demandedProducts.filter((p) =>
    validStationProducts.includes(p)
  ).length;
  const percentage =
    demandedProducts.length > 0
      ? Math.round((capturedCount / demandedProducts.length) * 100)
      : 100;

  // isComplete means we can compute orders for all products
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
