## Loading List Extraction - Simplified Schema

### Core Principle

**If we can read the product code, we have a complete item.**

Required fields for demand calculation:
- `primaryCode` (product ID like JOE.023596)
- `quantity` (default 1 if not shown)
- `activityCode` (which ACT.* it belongs to)

Everything else (description, secondaryCode, room, endUser) is optional metadata.

### Atomic Operation

The extraction is atomic - it either succeeds, warns, or fails entirely:

| Status | Meaning | Data Included |
|--------|---------|---------------|
| **success** | All images valid, extracted cleanly | Yes - full confidence |
| **warning** | Extracted but with issues | Yes - but review recommended |
| **error** | Cannot extract meaningful data | No - empty arrays |

### Schema

```ts
import { z } from "zod";

export const ActivitySchema = z.object({
  activityCode: z.string(), // e.g., "ACT.1642535"
});

export const LineItemSchema = z.object({
  activityCode: z.string(),
  primaryCode: z.string(),      // Required - for aggregation
  secondaryCode: z.string().optional(),
  description: z.string().optional(),
  internalCode: z.string().optional(),
  quantity: z.number().int().min(1),
  room: z.string().optional(),
  endUser: z.string().optional(),
});

export const LoadingListExtractionSchema = z.object({
  status: z.enum(["success", "warning", "error"]),
  message: z.string().optional(),
  activities: z.array(ActivitySchema),
  lineItems: z.array(LineItemSchema),
  summary: z.object({
    totalImages: z.number().int().min(0),
    validImages: z.number().int().min(0),
    totalActivities: z.number().int().min(0),
    totalLineItems: z.number().int().min(0),
  }),
});
```

### Demand Calculation

1. Skip groups with `status === "error"`
2. Count all line items from `success` and `warning` groups
3. Aggregate by `primaryCode` across all groups

### What the AI Handles Internally

- **Deduplication**: Same item in overlapping scroll screenshots = extract once
- **Scroll reconciliation**: Partial rows completed in next image
- **Image validation**: Identify non-loading-list images

The AI does NOT expose this complexity - it just returns clean results or an error.
