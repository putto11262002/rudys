import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { authKeys } from "./query-keys";

/**
 * Check if user is authenticated
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

/**
 * Login with access code
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const res = await client.api.auth.login.$post({
        json: { code },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error("error" in data ? data.error : "Login failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

/**
 * Logout
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.auth.logout.$post();

      if (!res.ok) {
        throw new Error("Logout failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}
