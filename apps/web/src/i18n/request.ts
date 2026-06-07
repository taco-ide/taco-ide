import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, locales, type Locale } from "./config";

/**
 * Resolves the active locale for every server render.
 *
 * Priority:
 *  1. The `NEXT_LOCALE` cookie (the user's explicit choice via the switcher).
 *  2. Otherwise the configured default locale (`en`).
 *
 * We intentionally do NOT auto-detect from `Accept-Language` so the default is
 * deterministic (English), matching the product decision. The cookie is the
 * single source of truth once the user picks a language.
 */
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

export { locales };
