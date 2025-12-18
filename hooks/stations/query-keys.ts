/**
 * Query key factory for station-related queries.
 * Follows the same pattern as other query key factories in this codebase.
 */
export const stationKeys = {
  all: ["stations"] as const,
  lists: () => [...stationKeys.all, "list"] as const,
  listBySession: (sessionId: string) =>
    [...stationKeys.lists(), { sessionId }] as const,
  details: () => [...stationKeys.all, "detail"] as const,
  detail: (id: string) => [...stationKeys.details(), id] as const,
  coverage: (sessionId: string) =>
    [...stationKeys.all, "coverage", { sessionId }] as const,
};
