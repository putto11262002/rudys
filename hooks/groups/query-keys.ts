export const groupKeys = {
  all: ["groups"] as const,
  lists: () => [...groupKeys.all, "list"] as const,
  listBySession: (sessionId: string) => [...groupKeys.lists(), sessionId] as const,
  detail: (id: string) => [...groupKeys.all, "detail", id] as const,
};
