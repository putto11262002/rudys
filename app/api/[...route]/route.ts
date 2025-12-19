import { Hono } from "hono";
import { handle } from "hono/vercel";
import { authMiddleware } from "@/lib/auth/middleware";
import { authRoutes } from "./_auth";
import { sessionRoutes } from "./_sessions";
import { groupRoutes } from "./_groups";
import { extractionRoutes } from "./_extraction";
import { demandRoutes } from "./_demand";
import { stationRoutes } from "./_stations";
import { orderRoutes } from "./_order";

// All routes chained in single expression for RPC type inference
const app = new Hono()
  .basePath("/api")
  // Public routes (no auth)
  .route("/auth", authRoutes)
  .get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  })
  // Auth middleware for all /sessions/* routes (covers all protected routes)
  .use("/sessions/*", authMiddleware)
  .use("/groups/*", authMiddleware)
  .use("/stations/*", authMiddleware)
  // Protected routes
  .route("/sessions", sessionRoutes)
  .route("/", groupRoutes)
  .route("/", extractionRoutes)
  .route("/", demandRoutes)
  .route("/", stationRoutes)
  .route("/", orderRoutes);

// Export HTTP method handlers for Next.js App Router
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);

// Export type for RPC client
export type AppType = typeof app;
