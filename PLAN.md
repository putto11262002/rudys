# Plan: Invalidate Demand and Order Queries on Upstream Mutations

## Problem

The demand and order calculations are computed on the backend. They depend on:
- **Demand** depends on: Loading list groups + extractions
- **Order** depends on: Loading list groups + extractions + station captures (inventory)

Currently, mutations to groups, extractions, and stations do NOT invalidate the demand/order queries. This means stale data could be shown on the Demand Review and Order pages after changes.

## Dependencies Map

```
Loading Lists (groups/extractions) → Demand → Order
                                              ↑
Stations (inventory) ────────────────────────┘
```

## Mutations That Should Invalidate

### Mutations affecting DEMAND (invalidate `demandKeys.bySession`):
1. `useCreateGroupWithImages` (hooks/groups/use-groups.ts) - new group added
2. `useDeleteGroup` (hooks/groups/use-groups.ts) - group deleted
3. `useStreamingExtraction` onFinish (hooks/extraction/use-streaming-extraction.ts) - extraction completed

### Mutations affecting ORDER (invalidate `orderKeys.bySession`):
1. All of the above (order depends on demand)
2. `useCreateStation` (hooks/stations/use-stations.ts) - new station added
3. `useDeleteStation` (hooks/stations/use-stations.ts) - station deleted
4. `useStreamingStationExtraction` onFinish (hooks/stations/use-streaming-station-extraction.ts) - station extraction completed

## Implementation

### File 1: `hooks/groups/use-groups.ts`

**Changes:**
- Import `demandKeys` from `../demand/query-keys`
- Import `orderKeys` from `../order/query-keys`
- Add to `useCreateGroupWithImages` onSuccess:
  ```typescript
  queryClient.invalidateQueries({ queryKey: demandKeys.bySession(sessionId) });
  queryClient.invalidateQueries({ queryKey: orderKeys.bySession(sessionId) });
  ```
- Add to `useDeleteGroup` onSuccess:
  ```typescript
  queryClient.invalidateQueries({ queryKey: demandKeys.bySession(sessionId) });
  queryClient.invalidateQueries({ queryKey: orderKeys.bySession(sessionId) });
  ```

### File 2: `hooks/extraction/use-streaming-extraction.ts`

**Changes:**
- Import `demandKeys` from `../demand/query-keys`
- Import `orderKeys` from `../order/query-keys`
- Add to `onFinish` callback (after cache update):
  ```typescript
  queryClient.invalidateQueries({ queryKey: demandKeys.bySession(sessionId) });
  queryClient.invalidateQueries({ queryKey: orderKeys.bySession(sessionId) });
  ```

### File 3: `hooks/stations/use-stations.ts`

**Changes:**
- Import `orderKeys` from `../order/query-keys`
- Add to `useCreateStation` onSuccess:
  ```typescript
  queryClient.invalidateQueries({ queryKey: orderKeys.bySession(sessionId) });
  ```
- Add to `useDeleteStation` onSuccess:
  ```typescript
  queryClient.invalidateQueries({ queryKey: orderKeys.bySession(sessionId) });
  ```

### File 4: `hooks/stations/use-streaming-station-extraction.ts`

**Changes:**
- Import `orderKeys` from `../order/query-keys`
- Add to `onFinish` callback (after cache update):
  ```typescript
  queryClient.invalidateQueries({ queryKey: orderKeys.bySession(sessionId) });
  ```

## Summary

| Hook | Invalidates Demand | Invalidates Order |
|------|-------------------|-------------------|
| useCreateGroupWithImages | ✅ | ✅ |
| useDeleteGroup | ✅ | ✅ |
| useStreamingExtraction | ✅ | ✅ |
| useCreateStation | ❌ | ✅ |
| useDeleteStation | ❌ | ✅ |
| useStreamingStationExtraction | ❌ | ✅ |

Station mutations only invalidate order (not demand) because demand doesn't depend on stations - only on loading list extractions.
