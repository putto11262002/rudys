import { cookies } from "next/headers";
import crypto from "crypto";
import { AUTH_COOKIE_NAME, SESSION_EXPIRY_SECONDS, COOKIE_OPTIONS } from "./constants";

const SESSION_SECRET = process.env.SESSION_SECRET || "default-secret-change-me-in-production";
const ACCESS_CODE = process.env.ACCESS_CODE;

interface SessionPayload {
  createdAt: number;
  expiresAt: number;
}

function createSignature(payload: string): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verify access code against environment variable
 */
export function verifyAccessCode(code: string): boolean {
  if (!ACCESS_CODE) {
    console.warn("ACCESS_CODE environment variable is not set");
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  if (code.length !== ACCESS_CODE.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(code), Buffer.from(ACCESS_CODE));
}

/**
 * Create a signed session token
 */
export function createSessionToken(): string {
  const now = Date.now();
  const payload: SessionPayload = {
    createdAt: now,
    expiresAt: now + SESSION_EXPIRY_SECONDS * 1000,
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = Buffer.from(payloadString).toString("base64url");
  const signature = createSignature(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

/**
 * Validate a session token
 */
export function validateSessionToken(token: string): boolean {
  try {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      return false;
    }

    // Verify signature
    const expectedSignature = createSignature(encodedPayload);
    if (!constantTimeCompare(signature, expectedSignature)) {
      return false;
    }

    // Decode and check expiration
    const payloadString = Buffer.from(encodedPayload, "base64url").toString();
    const payload: SessionPayload = JSON.parse(payloadString);

    if (payload.expiresAt < Date.now()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create session and set cookie (for use in API routes)
 */
export async function createSession(): Promise<string> {
  const token = createSessionToken();
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);

  return token;
}

/**
 * Validate current session from cookies
 */
export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  return validateSessionToken(token);
}

/**
 * Clear session cookie
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Validate session from request headers (for Hono middleware)
 */
export function validateSessionFromCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }

  // Parse cookies manually
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  const token = cookies[AUTH_COOKIE_NAME];
  if (!token) {
    return false;
  }

  return validateSessionToken(token);
}
