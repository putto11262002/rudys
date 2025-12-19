import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import {
  verifyAccessCode,
  createSessionToken,
  validateSessionFromCookie,
  AUTH_COOKIE_NAME,
  COOKIE_OPTIONS,
} from "@/lib/auth";

const loginSchema = z.object({
  code: z.string().min(1, "Access code is required"),
});

export const authRoutes = new Hono()
  // POST /api/auth/login - Verify code and create session
  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { code } = c.req.valid("json");

    const isValid = verifyAccessCode(code);

    if (!isValid) {
      return c.json({ error: "Invalid access code" }, 401);
    }

    const token = createSessionToken();

    setCookie(c, AUTH_COOKIE_NAME, token, {
      ...COOKIE_OPTIONS,
      // Hono uses different property names
      httpOnly: COOKIE_OPTIONS.httpOnly,
      secure: COOKIE_OPTIONS.secure,
      sameSite: COOKIE_OPTIONS.sameSite === "lax" ? "Lax" : "Strict",
      path: COOKIE_OPTIONS.path,
      maxAge: COOKIE_OPTIONS.maxAge,
    });

    return c.json({ success: true });
  })
  // POST /api/auth/logout - Clear session
  .post("/logout", (c) => {
    deleteCookie(c, AUTH_COOKIE_NAME, {
      path: "/",
    });

    return c.json({ success: true });
  })
  // GET /api/auth/check - Check if session is valid
  .get("/check", (c) => {
    const cookieHeader = c.req.header("cookie");
    const isValid = validateSessionFromCookie(cookieHeader ?? null);

    return c.json({ authenticated: isValid });
  });
