"use server";

import { cookies } from "next/headers";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/i18n/config";

/**
 * Persists the user's language choice in a cookie that every server render
 * reads (see `src/i18n/request.ts`). The caller should `router.refresh()`
 * afterwards so the tree re-renders with the new locale's messages.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const value: Locale = isLocale(locale) ? locale : defaultLocale;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
