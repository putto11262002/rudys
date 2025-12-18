export const orderKeys = {
  all: ["order"] as const,
  bySession: (sessionId: string) =>
    [...orderKeys.all, "session", sessionId] as const,
};
