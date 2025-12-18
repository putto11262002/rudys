# Photo Capture Flow Application Plan

## Overview
A multi-screen flow application for capturing loading list photos from multiple employee phones.

## Application Flow

```
[Start Screen] → [Capture Screen] → [Summary Screen]
       ↑                 ↓
       ←── "Capture Another" ──
```

## Architecture

### 1. Next.js Routing Structure (App Router)

```
app/
├── page.tsx                    # Start screen (entry point)
├── capture/
│   └── page.tsx               # Capture/Upload screen
├── summary/
│   └── page.tsx               # Summary screen
└── layout.tsx                 # Root layout with Context Provider
```

**Why this structure:**
- Uses Next.js App Router idiomatically with file-based routing
- Each screen is a separate route for proper navigation/back button support
- Context provider wraps at root layout level for global state access

### 2. Global State (React Context)

**Location:** `app/providers.tsx`

```typescript
interface PhoneCapture {
  id: string;                    // Unique ID for the phone session
  images: CapturedImage[];       // Array of captured/uploaded images
  capturedAt: Date;             // When this session was created
}

interface CapturedImage {
  id: string;
  dataUrl: string;              // Base64 data URL for preview
  file: File;                   // Original file for future upload
  capturedAt: Date;
}

interface CaptureContextType {
  phoneCaptures: PhoneCapture[];
  currentPhoneId: string | null;
  startNewPhoneCapture: () => void;
  addImageToCurrentPhone: (image: CapturedImage) => void;
  finalizeCurrentPhone: () => void;
  clearAll: () => void;
}
```

**Why Context over other solutions:**
- Simple, built-in React solution
- No external dependencies needed
- Sufficient for frontend-only state that persists across routes
- Easy to replace later with server state when backend is added

### 3. Screen Implementations

#### Screen 1: Start Screen (`app/page.tsx`)
- Simple centered layout with application title
- Single "Start" button
- On click: Initialize first phone capture session and navigate to `/capture`

**Shadcn Components:**
- `Button` (already installed)

#### Screen 2: Capture Screen (`app/capture/page.tsx`)
- Two options: "Take Photo" or "Upload Images"
- Take Photo: Opens device camera, allows multiple captures until "Done"
- Upload: Opens file picker with multiple selection
- Shows preview grid of captured images
- Bottom actions: "Capture Another Phone" or "Next"

**Shadcn Components to Install:**
- `Dialog` - For camera modal overlay

**Native HTML Elements:**
- `<input type="file" accept="image/*" capture="environment">` - For camera
- `<input type="file" accept="image/*" multiple>` - For bulk upload

#### Screen 3: Summary Screen (`app/summary/page.tsx`)
- Groups images by phone session (Phone 1, Phone 2, etc.)
- Shows thumbnail grid for each phone
- Collapsible sections per phone

**Shadcn Components:**
- `Card` (already installed)
- Optionally `Accordion` or `Collapsible` - For expandable phone sections

### 4. Implementation Details

#### Camera Capture Flow
```
User clicks "Take Photo"
    → Open camera input (native HTML5)
    → On capture: Add to current phone's images
    → Show preview with option to capture more
    → "Done" closes camera mode
```

#### Upload Flow
```
User clicks "Upload Images"
    → Open file picker (multiple selection)
    → On select: Add all to current phone's images
    → Show preview grid
```

#### Navigation Flow
```
Start → /capture (creates Phone 1)
    └── "Capture Another" → /capture (creates Phone 2, Phone 3, ...)
    └── "Next" → /summary
```

### 5. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/providers.tsx` | Create | Context provider with capture state |
| `app/layout.tsx` | Modify | Wrap children with CaptureProvider |
| `app/page.tsx` | Modify | Start screen with button |
| `app/capture/page.tsx` | Create | Capture/upload screen |
| `app/summary/page.tsx` | Create | Summary display screen |

### 6. Shadcn Components Required

**Already Installed:**
- Button
- Card

**Need to Install:**
- Dialog (for camera capture modal)

### 7. Styling Approach

- Use Tailwind CSS with existing shadcn CSS variables
- Mobile-first responsive design (this is primarily a mobile use case)
- Use existing color scheme from `globals.css`:
  - `bg-background`, `text-foreground` for base
  - `bg-primary`, `text-primary-foreground` for primary actions
  - `bg-muted`, `text-muted-foreground` for secondary elements
  - `border-border` for borders

### 8. Key Implementation Notes

1. **No custom reusable components** - All UI built directly in page files using shadcn primitives
2. **Client components** - Capture and summary pages need `"use client"` for state/interactions
3. **Image storage** - Store as base64 data URLs in context (temporary, frontend only)
4. **Camera access** - Use native HTML5 `<input type="file" capture>` for maximum compatibility
5. **File validation** - Accept only image types via `accept="image/*"`

## Approval Checklist

- [ ] Routing structure approved
- [ ] Context state shape approved
- [ ] Component selection approved
- [ ] File structure approved
