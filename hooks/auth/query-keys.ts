export const authKeys = {
  all: ["auth"] as const,
  check: () => [...authKeys.all, "check"] as const,
};
