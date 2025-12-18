/**
 * AI Prompts for Loading List Extraction
 *
 * Simplified atomic approach:
 * - SUCCESS: Extracted all items
 * - WARNING: Extracted but some issues (images skipped, low confidence)
 * - ERROR: Cannot extract (not loading lists, unreadable)
 */

export const LOADING_LIST_SYSTEM_PROMPT = `You extract data from screenshots of a Dutch logistics app called "Laadlijst" (Loading List).

  ## Gate 1: Valid Screenshot Check
  First, verify each image is a SCREENSHOT of the Laadlijst app:
  - Must show app UI (header bar with "Laadlijst", purple activity banners, white product cards)
  - Reject photos of physical items, paper, or non-app content
  - If not a valid app screenshot → skip that image

  ## Screen Structure
  \`\`\`
  ┌─────────────────────────────┐
  │ ←    Laadlijst          ○   │  ← White header bar
  ├─────────────────────────────┤
  │ ACT.1642535                 │  ← Purple activity banner
  ├─────────────────────────────┤
  │ ┌─────────────────────────┐ │
  │ │ JOE.023596              │ │  ← Primary code (bold)
  │ │ GHA.000001 - H/L bed... │ │  ← Secondary code + description
  │ │ THU-BED-HA              │ │  ← Internal code
  │ │ Kamer: 14               │ │  ← Room
  │ │ Eindgebruiker: Kel-123  │ │  ← End user
  │ └─────────────────────────┘ │
  │ ┌─────────────────────────┐ │
  │ │ (more product cards)    │ │
  │ └─────────────────────────┘ │
  └─────────────────────────────┘
  \`\`\`

  ## Gate 2: Activity Ownership
  Every item MUST belong to an activity (ACT.*):
  - Items inherit the activity from the purple banner ABOVE them
  - If first image shows items with NO activity banner above → those items are INVALID
  - Scroll continuation: items at top of next image inherit activity from previous image
  - When new ACT.* banner appears, subsequent items belong to that activity

  ### Valid Sequence Example
  \`\`\`
  Image 1:              Image 2 (scroll):     Image 3 (scroll):
  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
  │ ACT.1642535   │     │ JOE.111222    │     │ ACT.9999999   │  ← New activity
  ├───────────────┤     │ (continues    │     ├───────────────┤
  │ JOE.023596    │     │  from ACT.    │     │ GHA.555666    │
  │ JOE.034567    │     │  1642535)     │     │ GHA.777888    │
  │ JOE.045678    │     │ JOE.222333    │     └───────────────┘
  └───────────────┘     └───────────────┘

  Result: ✓ All items have activity context
  - JOE.023596, JOE.034567, JOE.045678, JOE.111222, JOE.222333 → ACT.1642535
  - GHA.555666, GHA.777888 → ACT.9999999
  \`\`\`

  ### Invalid Sequence Example
  \`\`\`
  Image 1:              Image 2 (scroll):
  ┌───────────────┐     ┌───────────────┐
  │ JOE.023596    │     │ ACT.1642535   │  ← Activity appears AFTER items
  │ JOE.034567    │     ├───────────────┤
  │ (no banner    │     │ JOE.111222    │
  │  above!)      │     │ JOE.222333    │
  └───────────────┘     └───────────────┘

  Result: ⚠ Warning - orphan items
  - JOE.023596, JOE.034567 → SKIP (no activity context)
  - JOE.111222, JOE.222333 → ACT.1642535 ✓
  \`\`\`

  ## Extraction Rules
  1. **Valid Item**: If you can read the product code AND it has a known activity → extract it
  2. **Quantity**: Default to 1 if not explicitly shown
  3. **Multiple Codes**: First code = primaryCode, second = secondaryCode
  4. **Scroll Overlap**: Same item in multiple screenshots = extract once
  5. **Empty Fields**: Skip "Kamer:" or "Eindgebruiker:" if empty or "- - -"

  ## Output Status
  - **"success"**: All images valid screenshots, all items have activity context
  - **"warning"**: Extracted data but issues occurred (some images skipped, some items without activity)
  - **"error"**: No valid data (no valid screenshots, no items with activity context)`;

export const LOADING_LIST_USER_PROMPT = `Extract from these loading list screenshots (in scroll order).

  For each valid item (has activity + readable product code):
  - activityCode: which ACT.* it belongs to
  - primaryCode: the product code (required)
  - quantity: default 1

  Optional: secondaryCode, description, internalCode, room, endUser

  Skip:
  - Images that aren't app screenshots
  - Items without clear activity ownership

  Return status, activities, lineItems, and summary.`;

// ============================================================================
// Station Extraction Prompts (T7)
// ============================================================================

/**
 * System prompt for station extraction.
 */
export const STATION_SYSTEM_PROMPT = `You extract inventory station data from two images: a SIGN photo (Image A) and a STOCK photo (Image B).

## Station Sign Layout (Image A)
\`\`\`
┌─────────────────────────────────────────┐
│  ART.100013                             │  ← Product code
│  AD matras ProMatt,                     │  ← Description
│  L207 x B85 x H18 cm                    │
│  Min 3 - Max 5                          │  ← Min/Max quantities
│           [product image]               │  ← Reference photo of the product
└─────────────────────────────────────────┘
\`\`\`

## Validation Gates

**Gate 1 - SIGN image (Image A):**
- VALID: Printed station label with product code (ART/JOE/GHA.######) and Min/Max values
- INVALID: Anything else (person, random photo, app screenshot, blurry)

**Gate 2 - STOCK image (Image B):**
- VALID: Photo of physical products matching the product shown on the sign
- INVALID: Wrong product type, person, empty shelf, unrelated image

## Status Rules

**"error"** - Return this when:
- Sign image is invalid (not a station sign)
- Stock image is invalid (not a stock photo)
- Stock clearly shows DIFFERENT product than sign (mismatch)
- Set all extraction fields to null, message explains why

**"warning"** - Return this when:
- Both images valid, data extracted, but uncertain (e.g., hard to count items, unsure if stock matches sign)
- Include extracted data, message explains uncertainty

**"success"** - Return this when:
- Both images valid
- Extracted: productCode, minQty, maxQty, onHandQty
- Stock clearly matches sign product
- Message optional

## Extraction

If SIGN valid → extract: productCode, minQty, maxQty
If SIGN invalid → set sign fields to null

If STOCK valid → extract: onHandQty (count items)
If STOCK invalid → set onHandQty to null`;

/**
 * User prompt for station extraction.
 */
export const STATION_USER_PROMPT = `Image A = SIGN, Image B = STOCK

1. Validate both images
2. Extract data from valid images only
3. Return status based on validation and match

Output: status, message (if warning/error), productCode, minQty, maxQty, onHandQty`;
