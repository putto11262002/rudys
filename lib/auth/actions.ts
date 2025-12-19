"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  verifyAccessCode,
  createSessionToken,
  AUTH_COOKIE_NAME,
  COOKIE_OPTIONS,
} from "./index";

export async function loginAction(
  code: string
): Promise<{ success: true } | { success: false; error: string }> {
  const isValid = verifyAccessCode(code);

  if (!isValid) {
    return { success: false, error: "Invalid access code" };
  }

  const token = createSessionToken();
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);

  // Revalidate all paths to clear Router Cache
  revalidatePath("/", "layout");

  return { success: true };
}

export async function logoutAction(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);

  // Revalidate all paths to clear Router Cache
  revalidatePath("/", "layout");

  return { success: true };
}
