# Plan: Split Station Extraction into Two Separate AI Calls

## Overview

Refactor station extraction from a single LLM call (sign + stock together) into two separate calls:
1. **Sign Extraction** - Extract product ID, min, max from sign image (simple OCR task)
2. **Stock Counting** - Count items in stock image (hard vision task requiring better model)

### Key Changes
- Remove product matching validation (no longer checking if stock matches sign)
- Use a dedicated high-accuracy vision model for stock counting
- Simpler, focused prompts for each task

---

## Research Findings

### Best Model for Stock Counting

Based on research, **Gemini 2.5 Flash** is recommended for stock counting:

| Model | Counting MAE | Cost (per 1M tokens) | Notes |
|-------|-------------|---------------------|-------|
| **Gemini 2.5 Flash** | 0.55-0.92 | $0.30 input / $2.50 output | Best accuracy for counting |
| Gemini 2.5 Flash-Lite | Similar | $0.075 / $0.30 | Budget option |
| GPT-4o Mini | 2.5+ | $0.15 / $0.60 | Current default |
| GPT-4o | 2.19-2.68 | $2.50 / $10.00 | Expensive |

**Recommendation:** Use `google/gemini-2.5-flash` for stock counting (not the "-lite" version).

### Stock Image Analysis

Examined sample stock images in Downloads/p1, p2, p3:

1. **p1/stock.webp** - Hospital beds on wheels, lined up in a row (count: ~7-8 beds)
2. **p2/stock.webp** - Mattresses stacked on pallets (count: ~6-7 mattresses visible)
3. **p3/stock.webp** - Medical equipment in bags inside a bin (count: ~10+ items, hard to count)

**Challenges identified:**
- Items can be stacked/overlapping
- Partial visibility (items behind others)
- Items wrapped in plastic bags
- Varying orientations (beds sideways, mattresses stacked)
- Mixed backgrounds (other products visible)

---

## Implementation Plan

### 1. New Schemas (`lib/ai/schemas/`)

#### `sign-extraction.ts` (NEW)
```typescript
export const SignExtractionSchema = z.object({
  status: z.enum(["success", "warning", "error"]),
  message: z.string().nullable().optional(),
  productCode: z.string().nullable().optional(),
  minQty: z.number().int().min(0).nullable().optional(),
  maxQty: z.number().int().min(0).nullable().optional(),
});
```

#### `stock-counting.ts` (NEW)
```typescript
export const StockCountingSchema = z.object({
  status: z.enum(["success", "warning", "error"]),
  message: z.string().nullable().optional(),
  onHandQty: z.number().int().min(0).nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  countingMethod: z.string().optional(), // How AI counted (for debugging)
});
```

#### `station-extraction.ts` (MODIFIED)
Keep existing schema but it becomes the **combined result** of both calls.

### 2. New Prompts (`lib/ai/prompts.ts`)

#### Sign Extraction Prompt (Simple OCR)
```typescript
export const SIGN_EXTRACTION_SYSTEM_PROMPT = `You extract data from station sign labels in a warehouse.

## Task
Read the printed station label and extract:
- Product code (format: ART.######, JOE.######, or GHA.######)
- Min quantity (integer)
- Max quantity (integer)

## Sign Layout
┌─────────────────────────────────────────┐
│  ART.100013                             │  ← Product code
│  AD matras ProMatt,                     │  ← Description (ignore)
│  L207 x B85 x H18 cm                    │
│  Min 3 - Max 5                          │  ← Min/Max quantities
│           [product image]               │  ← Reference photo (ignore)
└─────────────────────────────────────────┘

## Validation
- "success": Valid station label with readable product code and min/max
- "warning": Partial data (e.g., can read code but min/max unclear)
- "error": Not a station label OR completely unreadable

Extract ONLY what you can clearly read. Set fields to null if unreadable.`;

export const SIGN_EXTRACTION_USER_PROMPT = `Extract product code, min, and max from this station sign label.`;
```

#### Stock Counting Prompt (Specialized for counting)
```typescript
export const STOCK_COUNTING_SYSTEM_PROMPT = `You are an expert inventory counter. Your task is to count physical items in warehouse stock photos.

## Counting Strategy

1. **Identify the item type** - What are you counting? (beds, mattresses, boxes, bags, etc.)

2. **Find countable units** - Look for:
   - Distinct edges/boundaries between items
   - Wheels, handles, or other repeating features
   - Stacked layers (count layers × items per layer if uniform)
   - Individual packages/bags

3. **Count systematically** - Use one of these methods:
   - **Row counting**: Count items in each row, sum the rows
   - **Layer counting**: For stacked items, count visible layers
   - **Feature counting**: Count a distinctive feature (e.g., 4 wheels per bed = beds × 4)
   - **Direct counting**: Point to each item mentally, count 1, 2, 3...

4. **Handle partial visibility**:
   - If an item is >50% visible, count it
   - If <50% visible or completely hidden, don't count it
   - State in message if some items may be hidden

## Output

- **onHandQty**: Your best count of complete/mostly-visible items
- **confidence**:
  - "high" = clear separation, easy to count
  - "medium" = some overlap or partial visibility
  - "low" = significant occlusion, estimate
- **countingMethod**: Brief description of how you counted (e.g., "Counted 3 rows of 2 beds each")
- **message**: Note any uncertainty (e.g., "2 more may be hidden behind stack")

## Status
- "success": Could identify and count items
- "warning": Counted but uncertain (low confidence)
- "error": Cannot identify countable items (empty, wrong image type, too blurry)`;

export const STOCK_COUNTING_USER_PROMPT = `Count the number of items in this stock photo.

Look for the main product type and count how many complete units are visible.
Be systematic - describe your counting method.`;
```

### 3. New Extraction Functions (`lib/ai/`)

#### `extract-sign.ts` (NEW)
```typescript
export async function extractSign(
  signUrl: string,
  modelId?: string
): Promise<SignExtraction> {
  const selectedModel = modelId || DEFAULT_SIGN_MODEL; // gpt-4o-mini (simple OCR)

  const { object } = await generateObject({
    model: selectedModel,
    schema: SignExtractionSchema,
    messages: [
      { role: "system", content: SIGN_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: [
        { type: "text", text: SIGN_EXTRACTION_USER_PROMPT },
        { type: "image", image: signUrl },
      ]},
    ],
  });

  return object;
}
```

#### `extract-stock-count.ts` (NEW)
```typescript
export async function extractStockCount(
  stockUrl: string,
  modelId?: string
): Promise<StockCounting> {
  const selectedModel = modelId || DEFAULT_COUNTING_MODEL; // gemini-2.5-flash

  const { object } = await generateObject({
    model: selectedModel,
    schema: StockCountingSchema,
    messages: [
      { role: "system", content: STOCK_COUNTING_SYSTEM_PROMPT },
      { role: "user", content: [
        { type: "text", text: STOCK_COUNTING_USER_PROMPT },
        { type: "image", image: stockUrl },
      ]},
    ],
  });

  return object;
}
```

#### `extract-station.ts` (MODIFIED)
```typescript
export async function extractStation(
  signUrl: string,
  stockUrl: string,
  signModelId?: string,
  stockModelId?: string
): Promise<StationExtraction> {
  // Run both extractions in parallel
  const [signResult, stockResult] = await Promise.all([
    extractSign(signUrl, signModelId),
    extractStockCount(stockUrl, stockModelId),
  ]);

  // Combine results
  return combineExtractionResults(signResult, stockResult);
}

function combineExtractionResults(
  sign: SignExtraction,
  stock: StockCounting
): StationExtraction {
  // Determine overall status
  let status: "success" | "warning" | "error";
  let message: string | null = null;

  if (sign.status === "error" && stock.status === "error") {
    status = "error";
    message = `Sign: ${sign.message}. Stock: ${stock.message}`;
  } else if (sign.status === "error" || stock.status === "error") {
    status = "warning";
    message = sign.status === "error" ? sign.message : stock.message;
  } else if (sign.status === "warning" || stock.status === "warning") {
    status = "warning";
    message = [sign.message, stock.message].filter(Boolean).join(". ") || null;
  } else {
    status = "success";
  }

  return {
    status,
    message,
    productCode: sign.productCode,
    minQty: sign.minQty,
    maxQty: sign.maxQty,
    onHandQty: stock.onHandQty,
  };
}
```

### 4. Model Configuration (`lib/ai/models.ts`)

```typescript
// Add Gemini 2.5 Flash (full version) for counting
export const AVAILABLE_MODELS: Model[] = [
  // ... existing models ...
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
  },
];

// Default models by task
export const DEFAULT_SIGN_MODEL = "openai/gpt-4o-mini";      // Simple OCR
export const DEFAULT_COUNTING_MODEL = "google/gemini-2.5-flash"; // Best for counting

// Keep for backward compatibility
export const DEFAULT_STATION_MODEL = DEFAULT_SIGN_MODEL;

// Add pricing
export const MODEL_PRICING = {
  // ... existing ...
  "google/gemini-2.5-flash": { input: 0.30, output: 2.50 },
};
```

### 5. API Routes Updates

#### `app/api/station-extract-stream/route.ts` (MODIFIED)

Update to run two parallel streams or sequential calls:

```typescript
// Option A: Sequential (simpler, works with streaming)
// 1. Extract sign first (fast, simple)
// 2. Stream stock counting (slower, needs good model)

// Option B: Parallel non-streaming
// Run both generateObject calls in parallel, return combined result
```

**Recommendation:** Option B (parallel) for speed, since streaming partial results of two separate calls is complex.

#### `app/api/[...route]/_stations.ts`

Update `POST /stations/:id/extract` to accept optional model overrides:
```typescript
const { signModel, stockModel } = body;
const result = await extractStation(signUrl, stockUrl, signModel, stockModel);
```

### 6. Database Schema (NO CHANGES)

The `stationCaptures` table already has all needed fields:
- `productCode`, `minQty`, `maxQty` (from sign)
- `onHandQty` (from stock)
- `status`, `errorMessage` (combined status)
- `model`, `inputTokens`, `outputTokens`, `totalCost` (metadata)

**Note:** May want to store both models used, but this is optional.

### 7. UI Changes (NONE)

The extraction interface remains unchanged:
- User uploads sign + stock images
- System extracts data
- Results displayed in station card

The split is internal only.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `lib/ai/schemas/sign-extraction.ts` | CREATE | Schema for sign-only extraction |
| `lib/ai/schemas/stock-counting.ts` | CREATE | Schema for stock counting |
| `lib/ai/extract-sign.ts` | CREATE | Sign extraction function |
| `lib/ai/extract-stock-count.ts` | CREATE | Stock counting function |
| `lib/ai/extract-station.ts` | MODIFY | Orchestrate both calls, combine results |
| `lib/ai/prompts.ts` | MODIFY | Add new prompts for sign + stock |
| `lib/ai/models.ts` | MODIFY | Add Gemini 2.5 Flash, new defaults |
| `app/api/station-extract-stream/route.ts` | MODIFY | Update to use new extraction |
| `app/api/[...route]/_stations.ts` | MODIFY | Support model selection per task |

---

## Validation Approach

### What's Removed
- ❌ No longer checking if stock image matches sign image
- ❌ No "mismatch" error status

### What's Kept
- ✅ Sign validation (is it a valid station label?)
- ✅ Stock validation (is it a countable stock photo?)
- ✅ Individual status per extraction (success/warning/error)
- ✅ Combined overall status

### New Additions
- ✅ Confidence level for stock counting (high/medium/low)
- ✅ Counting method description (for debugging/transparency)
- ✅ Better model for difficult counting tasks

---

## Cost Impact

| Current (Single Call) | New (Two Calls) |
|-----------------------|-----------------|
| 1× GPT-4o Mini | 1× GPT-4o Mini (sign) |
| ~$0.15/1M input | + 1× Gemini 2.5 Flash (stock) |
| | ~$0.15 + $0.30 = $0.45/1M input |

**Estimate:** ~3x cost increase per extraction, but significantly better counting accuracy.

---

## Testing Plan

1. Test sign extraction with p1/sign.webp, p2/sign.webp, p3/sign.webp
2. Test stock counting with p1/stock.webp, p2/stock.webp, p3/stock.webp
3. Test combined extraction end-to-end
4. Verify no changes to external API contract (hooks, UI)

---

## Awaiting Approval

Please review this plan and confirm:
1. Two separate calls approach is acceptable
2. Gemini 2.5 Flash for counting is approved
3. Removal of sign/stock matching validation is OK
4. ~3x cost increase is acceptable for better accuracy
