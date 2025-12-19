import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { authKeys } from "./query-keys";

/**
 * Check if user is authenticated (for client-side checks if needed)
 */
export function useAuthCheck() {
  return useQuery({
    queryKey: authKeys.check(),
    queryFn: async () => {
      const res = await client.api.auth.check.$get();
      if (!res.ok) {
        throw new Error("Failed to check auth status");
      }
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Note: Login and logout are handled via server actions in lib/auth/actions.ts
// This allows proper cache revalidation with revalidatePath
