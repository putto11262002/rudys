# Streaming Extraction Persistence Fix

## Problem

When using Vercel AI SDK's `streamObject` with an `onFinish` callback for database persistence, the extraction results were not being reliably saved. The group/station status would update, but the actual extraction data was missing.

## Root Cause

The `onFinish` callback in `streamObject` is **not guaranteed to complete before the HTTP response ends**. When `toTextStreamResponse()` is called, the streaming response is sent to the client, but the `onFinish` callback runs asynchronously and may not complete before:
- The serverless function times out
- The connection closes
- The edge/serverless runtime garbage collects the callback

**Reference:** Vercel AI SDK GitHub issues #745, #5599, #1820

## Solution

### 1. Server-side: Use `result.object` Promise

Instead of relying on `onFinish`, use the `result.object` promise which resolves to the final validated object:

```typescript
const result = streamObject({
  model: selectedModel,
  schema: ExtractionSchema,
  messages: [...],
  // NO onFinish callback
});

// Use result.object promise for reliable persistence
result.object
  .then(async (finalObject) => {
    const usage = await result.usage;
    await saveToDatabase(finalObject, usage);
  })
  .catch(async (error) => {
    console.error('Extraction failed:', error);
    await updateStatusToError();
  });

return result.toTextStreamResponse();
```

### 2. Client-side: Use `setQueryData` Instead of `invalidateQueries`

When the stream completes on the client, the `onFinish` callback fires with the complete object. Instead of invalidating queries (which triggers a refetch that may arrive before server persistence completes), update the cache directly:

```typescript
const { object, submit, isLoading } = useObject({
  api: "/api/extract-stream",
  schema: ExtractionSchema,
  onFinish: (event) => {
    const finalObject = event.object;

    // Update cache directly - no server refetch needed
    queryClient.setQueryData(queryKey, (oldData) => {
      return {
        ...oldData,
        items: oldData.items.map((item) =>
          item.id === targetId
            ? { ...item, extractionResult: finalObject }
            : item
        ),
      };
    });
  },
});
```

## Files Modified

### Loading List Extraction

| File | Change |
|------|--------|
| `app/api/extract-stream/route.ts` | Replaced `onFinish` with `result.object` promise |
| `hooks/extraction/use-streaming-extraction.ts` | Replaced `invalidateQueries` with `setQueryData` |

### Station Extraction

| File | Change |
|------|--------|
| `app/api/station-extract-stream/route.ts` | **Created** - New streaming endpoint with `result.object` pattern |
| `hooks/stations/use-streaming-station-extraction.ts` | **Created** - New hook with `setQueryData` pattern |
| `hooks/stations/index.ts` | Added export for new hook |

## Flow Diagram

```
User triggers extract
        │
        ▼
useStreamingExtraction.extract(id, model)
        │
        ▼
POST /api/extract-stream ──────────────────────────┐
        │                                           │
        ▼                                           ▼
[====STREAMING to client====]           result.object.then(...)
        │                                           │
        ▼                                           ▼
Client onFinish fires                    DB PERSIST (parallel)
        │                                - extraction data
        ├── setQueryData()               - status update
        │   (immediate UI update)        - token usage, cost
        │
        └── UI reflects new data
            immediately
```

## Key Benefits

1. **Reliable persistence** - `result.object` promise is more reliable than `onFinish`
2. **Immediate UI update** - Cache updated with streamed data, no waiting for server
3. **No race condition** - Client doesn't refetch before server persists
4. **Proper error handling** - `.catch()` handles validation failures and stream errors

## API Reference

### Loading List Streaming Extraction

**Endpoint:** `POST /api/extract-stream`

**Request:**
```json
{
  "groupId": "uuid",
  "model": "openai/gpt-4.1-nano"  // optional
}
```

**Response:** Server-Sent Events stream with partial `LoadingListExtraction` objects

### Station Streaming Extraction

**Endpoint:** `POST /api/station-extract-stream`

**Request:**
```json
{
  "stationId": "uuid",
  "model": "openai/gpt-4.1-nano"  // optional
}
```

**Response:** Server-Sent Events stream with partial `StationExtraction` objects

## Hooks API

### `useStreamingExtraction`

```typescript
const {
  partialResult,    // Partial extraction (updates as stream progresses)
  isExtracting,     // Loading state
  isComplete,       // Completion flag
  extract,          // (groupId, model?) => void
  stop,             // Stop current extraction
  error,            // Error if failed
  groupId,          // Current group being extracted
} = useStreamingExtraction({
  sessionId: string,
  onComplete?: () => void,
  onError?: (error: Error) => void,
});
```

### `useStreamingStationExtraction`

```typescript
const {
  partialResult,    // Partial extraction (updates as stream progresses)
  isExtracting,     // Loading state
  isComplete,       // Completion flag
  extract,          // (stationId, model?) => void
  stop,             // Stop current extraction
  error,            // Error if failed
  stationId,        // Current station being extracted
} = useStreamingStationExtraction({
  sessionId: string,
  onComplete?: () => void,
  onError?: (error: Error) => void,
});
```
