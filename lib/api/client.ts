import { hc } from "hono/client";
import type { AppType } from "@/app/api/[...route]/route";

// Create type-safe Hono RPC client
export const client = hc<AppType>("/");

// Re-export type for convenience
export type { AppType };
