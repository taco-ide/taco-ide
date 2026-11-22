const SAME_ORIGIN_BASE = "http://same-origin.invalid";

/**
 * Returns `raw` as a same-origin path (`/path?query#hash`) when it is safe to
 * redirect to after login/signup, or `null` otherwise.
 *
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`), backslash
 * tricks (`/\evil.com`) and control characters so a crafted
 * `?redirect=` link can't send people to another site.
 */
export function getSafeRedirect(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;

  try {
    const url = new URL(raw, SAME_ORIGIN_BASE);
    if (url.origin !== SAME_ORIGIN_BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Builds `/auth/{page}?redirect=...&email=...`, skipping empty values. */
export function authPageHref(
  page: "login" | "signup",
  params: { redirect?: string | null; email?: string | null }
): string {
  const search = new URLSearchParams();
  const redirect = getSafeRedirect(params.redirect);
  if (redirect) search.set("redirect", redirect);
  if (params.email) search.set("email", params.email);
  const query = search.toString();
  return `/auth/${page}${query ? `?${query}` : ""}`;
}
