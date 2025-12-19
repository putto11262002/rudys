// Auth configuration constants

export const AUTH_COOKIE_NAME = "session";

export const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_EXPIRY_SECONDS,
};
