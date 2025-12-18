export const demandKeys = {
  all: ["demand"] as const,
  bySession: (sessionId: string) => [...demandKeys.all, "session", sessionId] as const,
};
