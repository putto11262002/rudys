# Session Flow Refactoring Plan

## Overview

Refactor the session flow from a **gate-based workflow** (status controls navigation and requires approval) to a **free-navigation workflow** where:

- Users navigate freely between all phases
- All aggregate data (demand, order) is **always computed** from raw data
- Session status only tracks "last visited phase" for resume purposes
- Partial/invalid data is gracefully filtered out during computation

---

## Current State (To Change)

| Aspect | Current | Target |
|--------|---------|--------|
| Session status | Gates navigation + requires specific transitions | Tracks last phase for resume only |
| Demand | Stored as snapshot after "Approve" action | Always computed from extractions |
| Order | Requires approved demand snapshot | Computed from extractions + stations |
| Navigation | Restricted based on status | Free navigation between all phases |
| Invalid data | Blocks progression | Filtered out, shows "as-is" |

---

## Changes Summary

### 1. Database Schema Changes

**Remove:**
- `demandSnapshots` table (and relation from sessions)

**Simplify:**
- `sessionState` enum: `["loading-lists", "demand", "inventory", "order"]` (phase names only)
- Rename `status` → `lastPhase` semantically (or keep `status` but treat as phase hint)

### 2. API Route Changes

**Remove:**
- `POST /sessions/:sessionId/demand/approve` - No longer needed

**Modify:**
- `GET /sessions/:sessionId/demand` - Always compute, never check snapshot
- `GET /sessions/:sessionId/order` - Compute from extractions + stations, no snapshot dependency
- `PATCH /sessions/:sessionId/status` - Simplified, just updates last phase

**Add:**
- `GET /sessions/:sessionId/workflow` - Single endpoint returning all computed state (optional optimization)

### 3. Computation Logic Changes

**Demand Computation** (`computeDemandFromGroups`):
- Filter out groups with no extraction result
- Filter out groups with `status === "error"`
- Filter out line items with missing `primaryCode`
- Return empty array if no valid data (not an error)

**Order Computation** (`computeOrderItems`):
- Takes: computed demand items + stations
- For each demand item:
  - Find matching station (by `productCode`, `status === "valid"`)
  - If station missing/invalid → skip item (filter out)
  - If station valid → compute order qty
- Return partial results (whatever is computable)
- Include metadata: `{ computed: [...], skipped: [...] }`

**Coverage Computation**:
- Computed from: demand items vs valid stations
- Returns: `{ covered: string[], missing: string[], percentage: number }`
- Not a blocker, just informational

### 4. Hook Changes

**Remove:**
- `useApproveDemand()` - No longer needed

**Modify:**
- `useDemand()` - Simpler, always returns computed data
- `useOrder()` - Returns computed items + skipped items

**Add:**
- `useUpdatePhase()` - Simple mutation to update `lastPhase`

### 5. UI Changes

**Loading Lists Page:**
- Remove "Continue to Review" button that updates status
- Add simple navigation link to demand page
- Update `lastPhase` when user navigates (optional)

**Demand Page:**
- Remove "Approve Demand" button entirely
- Remove approved/unapproved conditional rendering
- Show computed demand always
- Add navigation to inventory (always available)

**Inventory Page:**
- Remove coverage blocking logic
- Show coverage as informational (not a gate)
- Add navigation to order (always available)

**Order Page:**
- Handle partial data gracefully
- Show computed items + list skipped items
- Remove status checks

**Session Router (`/sessions/[id]/page.tsx`):**
- Use `lastPhase` as hint for redirect
- All phases accessible regardless of data state

---

## Detailed Implementation

### Phase 1: Schema Migration

```typescript
// lib/db/schema.ts

// CHANGE: Simplified phase enum
export const sessionPhase = [
  "loading-lists",
  "demand",
  "inventory",
  "order",
] as const;

// CHANGE: Rename status → lastPhase (or keep status, update semantics)
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  lastPhase: text("last_phase", { enum: sessionPhase })
    .notNull()
    .default("loading-lists"),
});

// REMOVE: demandSnapshots table
// REMOVE: demandSnapshotsRelations
// REMOVE: sessionsRelations.demandSnapshot reference
```

**Migration SQL:**
```sql
-- Drop demand_snapshots table
DROP TABLE IF EXISTS demand_snapshots;

-- Migrate status to lastPhase
ALTER TABLE sessions
  ALTER COLUMN status SET DEFAULT 'loading-lists';

-- Update existing values
UPDATE sessions SET status = 'loading-lists'
  WHERE status IN ('draft', 'capturing_loading_lists');
UPDATE sessions SET status = 'demand'
  WHERE status = 'review_demand';
UPDATE sessions SET status = 'inventory'
  WHERE status = 'capturing_inventory';
UPDATE sessions SET status = 'order'
  WHERE status IN ('review_order', 'completed');

-- Rename column (optional, can keep as 'status')
ALTER TABLE sessions RENAME COLUMN status TO last_phase;
```

### Phase 2: API Route Refactoring

#### 2.1 Demand Routes (`_demand.ts`)

```typescript
// REMOVE: POST /sessions/:sessionId/demand/approve entirely

// MODIFY: GET /sessions/:sessionId/demand
export const demandRoutes = new Hono()
  .get(
    "/sessions/:sessionId/demand",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      // Verify session exists
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });
      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      // Always compute from groups
      const groups = await db.query.employeeCaptureGroups.findMany({
        where: eq(employeeCaptureGroups.sessionId, sessionId),
        with: { extractionResult: true },
      });

      const demandItems = computeDemandFromGroups(groups);
      const totalQuantity = demandItems.reduce((sum, item) => sum + item.demandQty, 0);

      // Also compute stats for UI
      const stats = computeExtractionStats(groups);

      return c.json({
        items: demandItems,
        totalProducts: demandItems.length,
        totalQuantity,
        stats, // { totalGroups, extractedGroups, totalActivities, totalLineItems, totalCost }
      });
    }
  );
```

#### 2.2 Order Routes (`_order.ts`)

```typescript
// MODIFY: GET /sessions/:sessionId/order
export const orderRoutes = new Hono()
  .get(
    "/sessions/:sessionId/order",
    zValidator("param", z.object({ sessionId: z.string().uuid() })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });
      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      // Compute demand from groups (not from snapshot)
      const groups = await db.query.employeeCaptureGroups.findMany({
        where: eq(employeeCaptureGroups.sessionId, sessionId),
        with: { extractionResult: true },
      });
      const demandItems = computeDemandFromGroups(groups);

      // Get stations
      const stations = await db.query.stationCaptures.findMany({
        where: eq(stationCaptures.sessionId, sessionId),
      });

      // Compute order with graceful handling
      const { computed, skipped } = computeOrderItems(demandItems, stations);

      // Compute coverage info
      const coverage = computeCoverage(demandItems, stations);

      return c.json({
        session: { id: session.id, createdAt: session.createdAt },
        orderItems: computed,
        skippedItems: skipped, // Products without valid stations
        coverage, // { covered, missing, percentage }
      });
    }
  );
```

#### 2.3 Sessions Routes (`_sessions.ts`)

```typescript
// MODIFY: PATCH /sessions/:sessionId - Simplified phase update
.patch(
  "/sessions/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().uuid() })),
  zValidator("json", z.object({
    lastPhase: z.enum(["loading-lists", "demand", "inventory", "order"])
  })),
  async (c) => {
    const { sessionId } = c.req.valid("param");
    const { lastPhase } = c.req.valid("json");

    const [updated] = await db
      .update(sessions)
      .set({ lastPhase })
      .where(eq(sessions.id, sessionId))
      .returning();

    if (!updated) {
      return c.json({ error: "Session not found" }, 404);
    }

    return c.json(updated);
  }
)
```

### Phase 3: Computation Utilities

Create new file: `lib/workflow/compute.ts`

```typescript
import type { DemandItemJson, StationCapture } from "@/lib/db/schema";

// ============================================================================
// Demand Computation
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

export function computeDemandFromGroups(
  groups: Array<{
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
    } | null;
  }>
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
      if (typeof lineItem.quantity !== "number" || lineItem.quantity <= 0) continue;

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
          sources: [{
            groupId: group.id,
            employeeLabel: group.employeeLabel,
            activityCode: lineItem.activityCode,
          }],
        });
      }
    }
  }

  return Array.from(demandMap.values())
    .sort((a, b) => a.productCode.localeCompare(b.productCode));
}

// ============================================================================
// Order Computation
// ============================================================================

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

export function computeOrderItems(
  demandItems: ComputedDemandItem[],
  stations: StationCapture[]
): { computed: ComputedOrderItem[]; skipped: SkippedOrderItem[] } {
  const computed: ComputedOrderItem[] = [];
  const skipped: SkippedOrderItem[] = [];

  for (const demand of demandItems) {
    // Find station for this product
    const station = stations.find(s => s.productCode === demand.productCode);

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

export type CoverageInfo = {
  covered: string[];
  missing: string[];
  percentage: number;
  isComplete: boolean;
};

export function computeCoverage(
  demandItems: ComputedDemandItem[],
  stations: StationCapture[]
): CoverageInfo {
  const demandedProducts = demandItems.map(d => d.productCode);
  const validStationProducts = stations
    .filter(s => s.status === "valid" && s.onHandQty !== null)
    .map(s => s.productCode)
    .filter((p): p is string => p !== null);

  const covered = demandedProducts.filter(p => validStationProducts.includes(p));
  const missing = demandedProducts.filter(p => !validStationProducts.includes(p));
  const percentage = demandedProducts.length > 0
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

export type ExtractionStats = {
  totalGroups: number;
  extractedGroups: number;
  errorGroups: number;
  totalActivities: number;
  totalLineItems: number;
  totalCost: number;
};

export function computeExtractionStats(
  groups: Array<{
    extractionResult: {
      status: string;
      summary: { totalActivities: number; totalLineItems: number };
      totalCost: number | null;
    } | null;
  }>
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
```

### Phase 4: Hook Updates

#### 4.1 Demand Hooks (`hooks/demand/use-demand.ts`)

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { demandKeys } from "./query-keys";

// Simplified - no more approve mutation
export function useDemand(sessionId: string) {
  return useQuery({
    queryKey: demandKeys.bySession(sessionId),
    queryFn: async () => {
      const res = await client.api.sessions[":sessionId"].demand.$get({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to fetch demand");
      }
      return res.json();
    },
    enabled: !!sessionId,
  });
}

// REMOVE: useApproveDemand - no longer needed
```

#### 4.2 Order Hooks (`hooks/order/use-order.ts`)

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { orderKeys } from "./query-keys";

export function useOrder(sessionId: string) {
  return useQuery({
    queryKey: orderKeys.bySession(sessionId),
    queryFn: async () => {
      const res = await client.api.sessions[":sessionId"].order.$get({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to fetch order");
      }
      return res.json();
    },
    enabled: !!sessionId,
  });
}
```

#### 4.3 Session Hooks (`hooks/sessions/use-sessions.ts`)

```typescript
// ADD: useUpdatePhase mutation
export function useUpdatePhase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      phase
    }: {
      sessionId: string;
      phase: "loading-lists" | "demand" | "inventory" | "order"
    }) => {
      const res = await client.api.sessions[":sessionId"].$patch({
        param: { sessionId },
        json: { lastPhase: phase },
      });
      if (!res.ok) throw new Error("Failed to update phase");
      return res.json();
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
    },
  });
}

// REMOVE or SIMPLIFY: useUpdateSessionStatus
// (rename to useUpdatePhase if keeping)
```

### Phase 5: UI Updates

#### 5.1 Session Router (`app/sessions/[id]/page.tsx`)

```typescript
"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/sessions";
import { Loader2 } from "lucide-react";

// Simple phase-to-route mapping
const phaseToRoute: Record<string, string> = {
  "loading-lists": "loading-lists",
  "demand": "demand",
  "inventory": "inventory",
  "order": "order",
};

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, isLoading } = useSession(id);

  useEffect(() => {
    if (session) {
      const route = phaseToRoute[session.lastPhase] ?? "loading-lists";
      router.replace(`/sessions/${id}/${route}`);
    }
  }, [session, id, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return null;
}
```

#### 5.2 Loading Lists Page - Navigation Changes

```typescript
// REMOVE: handleContinueToReview with status update
// REPLACE WITH: Simple Link navigation

// In the floating footer:
<Link href={`/sessions/${sessionId}/demand`}>
  <Button>
    Continue to Demand Review
    <ArrowRight className="size-4 ml-2" />
  </Button>
</Link>

// Optionally update phase when navigating (fire-and-forget)
const updatePhase = useUpdatePhase();
const handleNavigate = () => {
  updatePhase.mutate({ sessionId, phase: "demand" });
  router.push(`/sessions/${sessionId}/demand`);
};
```

#### 5.3 Demand Page - Remove Approval

```typescript
// REMOVE: All approved/unapproved conditional logic
// REMOVE: "Approve Demand" button
// REMOVE: useApproveDemand hook usage

// SIMPLIFY to:
export default function DemandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useDemand(id);

  // Always show computed demand
  return (
    <div className="container py-6">
      {/* Header with back nav */}
      <Link href={`/sessions/${id}/loading-lists`}>
        <ArrowLeft /> Back to Loading Lists
      </Link>

      {/* Stats cards */}
      <StatsCards stats={data?.stats} />

      {/* Demand table - always shown */}
      <DemandTable items={data?.items ?? []} />

      {/* Navigation footer - always available */}
      <div className="fixed bottom-0 ...">
        <Link href={`/sessions/${id}/inventory`}>
          Continue to Inventory
        </Link>
      </div>
    </div>
  );
}
```

#### 5.4 Inventory Page - Remove Blocking

```typescript
// CHANGE: Coverage is informational only, not blocking

// Show coverage as info banner, not gate:
{coverage && !coverage.isComplete && (
  <Alert variant="info">
    <AlertTitle>Coverage: {coverage.percentage}%</AlertTitle>
    <AlertDescription>
      {coverage.missing.length} products still need station captures:
      {coverage.missing.join(", ")}
    </AlertDescription>
  </Alert>
)}

// Navigation always available:
<Link href={`/sessions/${id}/order`}>
  <Button>
    Continue to Order Review
    <ArrowRight className="size-4 ml-2" />
  </Button>
</Link>
```

#### 5.5 Order Page - Handle Partial Data

```typescript
export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useOrder(id);

  return (
    <div className="container py-6">
      {/* Show skipped items warning if any */}
      {data?.skippedItems?.length > 0 && (
        <Alert variant="warning">
          <AlertTitle>Incomplete Coverage</AlertTitle>
          <AlertDescription>
            {data.skippedItems.length} products skipped due to missing station data:
            <ul>
              {data.skippedItems.map(item => (
                <li key={item.productCode}>
                  {item.productCode}: {item.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Order table - shows computed items only */}
      <OrderTable items={data?.orderItems ?? []} />

      {/* Order text card - generates from computed items */}
      <OrderTextCard items={data?.orderItems ?? []} sessionCreatedAt={data?.session.createdAt} />

      {/* Navigation */}
      <div className="flex gap-4">
        <Link href={`/sessions/${id}/inventory`}>
          <Button variant="outline">Back to Inventory</Button>
        </Link>
        <Link href="/">
          <Button>Done</Button>
        </Link>
      </div>
    </div>
  );
}
```

---

## Migration Steps (Execution Order)

### Step 1: Create computation utilities
- Create `lib/workflow/compute.ts` with all pure computation functions
- Add unit tests for computation functions

### Step 2: Update API routes
- Modify `_demand.ts` to always compute (remove snapshot logic)
- Modify `_order.ts` to compute from raw data (remove snapshot dependency)
- Remove approve endpoint
- Simplify session status endpoint

### Step 3: Database migration
- Create migration to drop `demand_snapshots` table
- Update `sessions.status` enum and values
- Run migration

### Step 4: Update schema types
- Remove `demandSnapshots` from schema.ts
- Update session type with new phase enum
- Update relations

### Step 5: Update hooks
- Remove `useApproveDemand`
- Simplify `useDemand` return type
- Update `useOrder` return type
- Add `useUpdatePhase`

### Step 6: Update UI pages
- Demand page: Remove approve logic
- Inventory page: Remove blocking logic
- Order page: Handle partial data
- All pages: Simplify navigation

### Step 7: Update session router
- Use `lastPhase` for redirect
- Allow all routes regardless of data state

### Step 8: Cleanup
- Remove unused types
- Remove unused imports
- Update any remaining references

---

## Testing Checklist

- [ ] Empty session: Can navigate all phases, shows empty state
- [ ] Partial extraction: Demand computed from available data
- [ ] No extractions: Demand shows empty, order shows empty
- [ ] Partial stations: Order computes what's available, skips rest
- [ ] Full flow: All data computed correctly end-to-end
- [ ] Navigation: Can go back and forth freely
- [ ] Resume: Session opens at last visited phase
- [ ] Data updates: Going back, editing, shows updated downstream

---

## Files to Modify

| File | Action |
|------|--------|
| `lib/db/schema.ts` | Remove demandSnapshots, update session enum |
| `lib/workflow/compute.ts` | CREATE - all computation functions |
| `app/api/[...route]/_demand.ts` | Simplify, remove approve |
| `app/api/[...route]/_order.ts` | Compute from raw data |
| `app/api/[...route]/_sessions.ts` | Simplify status update |
| `hooks/demand/use-demand.ts` | Remove useApproveDemand |
| `hooks/order/use-order.ts` | Update return type |
| `hooks/sessions/use-sessions.ts` | Add useUpdatePhase |
| `app/sessions/[id]/page.tsx` | Use lastPhase |
| `app/sessions/[id]/loading-lists/_components/group-list-client.tsx` | Simplify nav |
| `app/sessions/[id]/demand/page.tsx` | Remove approve UI |
| `app/sessions/[id]/inventory/page.tsx` | Remove blocking |
| `app/sessions/[id]/order/page.tsx` | Handle partial data |
| `drizzle/migrations/` | New migration for schema |
