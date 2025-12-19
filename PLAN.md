# Plan: Decouple Extraction from Loading List Items + Catalog Validation

## Problem Statement

Currently:
1. **Tight coupling**: Extraction results ARE the loading list items (stored directly in `loadingListExtractionResults.lineItems`)
2. **No validation**: Extracted product codes aren't validated against the catalog
3. **Redundant data**: Descriptions are extracted but already exist in catalog
4. **No manual entry path**: Can't add loading list items without extraction

## Proposed Architecture

### Core Concept: Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI EXTRACTION LAYER                          │
│  - Raw AI output (what the model saw)                              │
│  - Includes metadata: model, tokens, cost, confidence              │
│  - Immutable audit trail                                           │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Transform + Validate
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER (Loading List)                │
│  - Validated line items (product must exist in catalog)            │
│  - Optional FK to extraction (null = manual entry)                 │
│  - Description from catalog (not extraction)                       │
│  - Rejected items tracked separately                               │
└─────────────────────────────────────────────────────────────────────┘
```

### New Database Schema

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ loading_list_extractions     │     │ loading_list_items           │
│ (AI output - audit trail)    │     │ (application data)           │
├──────────────────────────────┤     ├──────────────────────────────┤
│ id (PK)                      │     │ id (PK)                      │
│ group_id (FK)                │◄────│ extraction_id (FK, nullable) │
│ status (success/warn/error)  │     │ group_id (FK)                │
│ message                      │     │ activity_code                │
│ raw_activities (jsonb)       │     │ product_code (validated)     │
│ raw_line_items (jsonb)       │     │ quantity                     │
│ summary (jsonb)              │     │ source ("extraction"/"manual")│
│ model                        │     │ created_at                   │
│ input_tokens                 │     └──────────────────────────────┘
│ output_tokens                │
│ total_cost                   │     ┌──────────────────────────────┐
│ extracted_at                 │     │ loading_list_rejected_items  │
└──────────────────────────────┘     │ (products not in catalog)    │
                                     ├──────────────────────────────┤
                                     │ id (PK)                      │
                                     │ extraction_id (FK)           │
                                     │ group_id (FK)                │
                                     │ activity_code                │
                                     │ raw_product_code             │
                                     │ raw_description              │
                                     │ quantity                     │
                                     │ reason ("not_in_catalog")    │
                                     │ created_at                   │
                                     └──────────────────────────────┘
```

## Key Design Decisions

### 1. Product Mismatch Handling: **Drop + Track**

**Decision**: Products not in catalog are REJECTED (not counted in demand) but TRACKED for visibility.

**Rationale**:
- Unknown products can't be ordered anyway (no min/max, no station to capture)
- Silently dropping is bad UX - user should know what was rejected
- Tracked rejections allow:
  - User to see what was skipped
  - Future manual override if needed
  - Identifying catalog gaps

**Alternative considered**: Fuzzy matching (e.g., "JOE.002150" → "JOE.002151")
- Rejected because: Too risky for inventory management, wrong product is worse than no product

### 2. Extraction Schema Changes

**AI outputs** (unchanged for extraction layer):
- `primaryCode` - raw extracted code
- `quantity` - raw extracted quantity (default 1)
- `description` - raw extracted description (for audit, NOT used in app)
- `activityCode` - raw extracted activity

**Application transforms to**:
- `productCode` - validated against catalog (must exist)
- `quantity` - from extraction
- `description` - FROM CATALOG (not extraction)
- `activityCode` - from extraction

### 3. Description Source: **Always Catalog**

**Decision**: Never store/use extracted descriptions. Always use catalog.

**Rationale**:
- Catalog is authoritative (consistent, correct spelling)
- Extracted descriptions may be:
  - Truncated (cut off in image)
  - OCR errors
  - In different language
- Reduces AI prompt complexity (don't need to extract description)
- Smaller extraction payload

### 4. Extraction FK: **Nullable**

```typescript
loadingListItems.extractionId: uuid | null
```

- `extractionId = uuid` → Item came from AI extraction
- `extractionId = null` → Item was manually entered

This enables future manual entry without extraction.

### 5. Activities: **Keep in Extraction Only**

Activities (`ACT.*`) are metadata for grouping/display, not for demand calculation.

**Decision**: Don't create a separate `activities` table. Keep in extraction result.

**Rationale**:
- Activities aren't validated against anything
- Only used for drilldown display
- Line items already have `activityCode` for grouping
- Keep schema simple

## Data Flow

### Extraction Flow (Changed)

```
1. User uploads images → Group created
2. User triggers extraction → AI runs
3. AI returns raw result:
   {
     status: "success",
     activities: [{ activityCode: "ACT.123" }],
     lineItems: [
       { activityCode: "ACT.123", primaryCode: "JOE.002150", quantity: 1 },
       { activityCode: "ACT.123", primaryCode: "INVALID.999", quantity: 2 },
     ]
   }
4. Server validates each line item against catalog:
   - JOE.002150 exists → INSERT INTO loading_list_items
   - INVALID.999 not found → INSERT INTO loading_list_rejected_items
5. Extraction result stored as audit trail (raw_line_items)
6. Group status updated based on validation results
```

### Demand Computation (Changed)

```typescript
// BEFORE: Read from extraction results
const demand = computeDemandFromGroups(groups); // reads extractionResult.lineItems

// AFTER: Read from loading_list_items table
const items = await db.query.loadingListItems.findMany({
  where: eq(loadingListItems.groupId, groupId),
});
const demand = aggregateByProduct(items);
```

## Edge Cases

### E1: All items rejected
- Extraction status = "warning"
- Message = "All items rejected: not in product catalog"
- Group status = "needs_attention"
- Demand contribution = 0

### E2: Some items rejected
- Extraction status = "warning" (not "success")
- Message = "X items rejected: not in product catalog"
- Valid items still count toward demand
- User can see rejection list

### E3: Re-extraction
- DELETE existing items for group
- DELETE existing rejections for group
- Process new extraction
- (Extraction audit trail preserved with new row)

### E4: Product code variations
What if AI extracts "JOE.2150" but catalog has "JOE.002150"?

**Decision**: Strict matching only. No fuzzy/normalized matching.

**Rationale**:
- Product codes should be exact in source images
- If AI consistently misreads, that's a prompt/model issue to fix
- Fuzzy matching could match wrong product

**Future consideration**: Could add normalization (strip leading zeros) if proven necessary.

### E5: Duplicate products in same activity
AI might extract same product twice (from overlapping screenshots).

**Decision**: Let AI handle deduplication (current behavior).

The AI prompt already instructs deduplication. If duplicates slip through:
- Both are validated and inserted
- Demand aggregation sums them (which is wrong)
- This is an AI quality issue, not schema issue

### E6: Manual entry (future)
User wants to add item without extraction.

**Implementation path**:
```typescript
// POST /api/groups/:groupId/items (manual)
await db.insert(loadingListItems).values({
  groupId,
  extractionId: null, // No extraction
  activityCode: "MANUAL",
  productCode: validatedProductCode,
  quantity: userQuantity,
  source: "manual",
});
```

## Migration Strategy

### Phase 1: Schema Migration
1. Create `loading_list_items` table
2. Create `loading_list_rejected_items` table
3. Rename `loadingListExtractionResults` → `loading_list_extractions`
4. Add `raw_` prefix to jsonb columns (clarify they're raw AI output)

### Phase 2: Code Migration
1. Update extraction endpoint to:
   - Save raw extraction to `loading_list_extractions`
   - Validate items against catalog
   - Insert valid items to `loading_list_items`
   - Insert invalid items to `loading_list_rejected_items`
2. Update `computeDemandFromGroups` to read from `loading_list_items`
3. Update UI to show rejected items

### Phase 3: Cleanup
1. Backfill existing data (optional - or just let new extractions use new schema)
2. Remove unused columns/types

## Files to Modify

### Schema
- `lib/db/schema.ts` - New tables, rename existing

### API
- `app/api/[...route]/_extraction.ts` - Validation logic
- `app/api/extract-stream/route.ts` - Streaming extraction
- `app/api/[...route]/_demand.ts` - Read from items table

### Hooks
- `hooks/extraction/` - Types for new schema

### Computation
- `lib/workflow/compute.ts` - Read from items table

### UI
- `app/sessions/[id]/loading-lists/_components/group-card.tsx` - Show rejections
- `app/sessions/[id]/demand/page.tsx` - Show rejection summary

## Open Questions (Resolved)

### Q1: Should we remove description from extraction schema?
**Answer**: No. Keep for audit trail. Just don't use in application layer.

### Q2: Should activities be validated?
**Answer**: No. Activities are just grouping metadata. No catalog for activities.

### Q3: What if catalog is updated and product now exists?
**Answer**: Re-run extraction. This is manual. No auto-revalidation.

### Q4: Should we track which catalog version validated the item?
**Answer**: No. Over-engineering for v1. Catalog is static in code.

## Summary of Changes

| Current | Proposed |
|---------|----------|
| Extraction result = loading list | Extraction = audit trail only |
| Description from AI | Description from catalog |
| No validation | Catalog validation required |
| Unknown products counted | Unknown products rejected + tracked |
| No manual entry path | FK nullable enables manual entry |
| `loadingListExtractionResults.lineItems` | `loading_list_items` table |

## Approval Checklist

- [ ] Schema design approved
- [ ] Product mismatch handling (drop + track) approved
- [ ] Description source (catalog only) approved
- [ ] Edge case handling approved
- [ ] Migration strategy approved
