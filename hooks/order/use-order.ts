"use client";

import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { orderKeys } from "./query-keys";
import type { OrderResponse } from "./types";

export function useOrder(sessionId: string) {
  return useQuery({
    queryKey: orderKeys.bySession(sessionId),
    queryFn: async (): Promise<OrderResponse> => {
      const res = await client.api.sessions[":sessionId"].order.$get({
        param: { sessionId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          "error" in error ? error.error : "Failed to fetch order"
        );
      }
      return res.json() as Promise<OrderResponse>;
    },
    enabled: !!sessionId,
  });
}
