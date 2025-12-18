export const extractionKeys = {
  all: ["extraction"] as const,
  result: (groupId: string) =>
    [...extractionKeys.all, "result", groupId] as const,
};
