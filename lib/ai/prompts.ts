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
// Station Extraction Prompts (T7) - Split into Sign + Stock
// ============================================================================

/**
 * System prompt for sign extraction (simple OCR task).
 */
export const SIGN_EXTRACTION_SYSTEM_PROMPT = `You extract data from station sign labels in a warehouse.

## Task
Read the printed station label and extract:
- Product code (format: XXX.###### where XXX is a 3-letter prefix like ART, JOE, GHA, etc.)
- Min quantity (integer)
- Max quantity (integer)

## Product Code Format
- Pattern: 3 letters + dot + 6 digits (e.g., ART.100013, gha.000001)
- The prefix may appear in lowercase or uppercase on the sign
- ALWAYS normalize to UPPERCASE in output (e.g., "gha.000001" → "GHA.000001")

## Sign Layout
\`\`\`
┌─────────────────────────────────────────┐
│  ART.100013                             │  ← Product code
│  AD matras ProMatt,                     │  ← Description (ignore)
│  L207 x B85 x H18 cm                    │
│  Min 3 - Max 5                          │  ← Min/Max quantities
│           [product image]               │  ← Reference photo (ignore)
└─────────────────────────────────────────┘
\`\`\`

## Output Format
Return a JSON object with these fields:
- status: "success" | "warning" | "error"
- message: string or null (explanation for warning/error)
- productCode: string or null (UPPERCASE, e.g., "ART.100013", "GHA.000001")
- minQty: integer or null
- maxQty: integer or null

## Status Rules
- "success": Valid station label with readable product code AND min AND max
- "warning": Partial data (e.g., can read code but min/max unclear)
- "error": Not a station label OR completely unreadable

Extract ONLY what you can clearly read. Set fields to null if unreadable.`;

/**
 * User prompt for sign extraction.
 */
export const SIGN_EXTRACTION_USER_PROMPT = `Extract product code, min, and max from this station sign label.

Return JSON with: status, message, productCode, minQty, maxQty`;

/**
 * System prompt for stock counting (specialized counting task).
 */
export const STOCK_COUNTING_SYSTEM_PROMPT = `You are an expert inventory counter. Your task is to count physical items in warehouse stock photos.

## Counting Strategy

1. **Identify the item type** - What are you counting? (beds, mattresses, boxes, bags, equipment, etc.)

2. **Find countable units** - Look for:
   - Distinct edges/boundaries between items
   - Wheels, handles, or other repeating features
   - Stacked layers (count layers × items per layer if uniform)
   - Individual packages/bags

3. **Count systematically** - Use one of these methods:
   - **Row counting**: Count items in each row, sum the rows
   - **Layer counting**: For stacked items, count visible layers
   - **Feature counting**: Count a distinctive feature (e.g., 4 wheels per bed = total wheels ÷ 4)
   - **Direct counting**: Point to each item mentally, count 1, 2, 3...

4. **Handle partial visibility**:
   - If an item is >50% visible, count it
   - If <50% visible or completely hidden, don't count it
   - State in message if some items may be hidden

## Output Format
Return a JSON object with these exact fields:
- status: "success" | "warning" | "error"
- message: string or null (note any uncertainty)
- onHandQty: integer or null (your count)
- confidence: "high" | "medium" | "low"
- countingMethod: string (brief description of how you counted)

## Status Rules
- "success": Could identify and count items with high or medium confidence
- "warning": Counted but uncertain (low confidence)
- "error": Cannot identify countable items (empty area, wrong image type, too blurry)`;

/**
 * User prompt for stock counting.
 */
export const STOCK_COUNTING_USER_PROMPT = `Count the number of items in this stock photo.

Look for the main product type and count how many complete units are visible.
Be systematic - describe your counting method.

Return JSON with: status, message, onHandQty, confidence, countingMethod`;

// Legacy prompts for backward compatibility (combined extraction)
// These are kept but no longer used by the new split extraction

/**
 * @deprecated Use SIGN_EXTRACTION_SYSTEM_PROMPT and STOCK_COUNTING_SYSTEM_PROMPT instead
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
 * @deprecated Use SIGN_EXTRACTION_USER_PROMPT and STOCK_COUNTING_USER_PROMPT instead
 */
export const STATION_USER_PROMPT = `Image A = SIGN, Image B = STOCK

1. Validate both images
2. Extract data from valid images only
3. Return status based on validation and match

Output: status, message (if warning/error), productCode, minQty, maxQty, onHandQty`;
