import { createMiddleware } from "hono/factory";
import { validateSessionFromCookie } from "./session";

/**
 * Hono middleware to protect API routes
 * Returns 401 if session is invalid
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const cookieHeader = c.req.header("cookie");
  const isValid = validateSessionFromCookie(cookieHeader ?? null);

  if (!isValid) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});
