import { APIError } from "better-auth/api";

/**
 * Better Auth organization endpoints that browsers may call directly over
 * HTTP (`/api/auth/*` or `/v1/auth/*`).
 *
 * Organizations, members and invitations are managed only through the product
 * routes under `/v1/organizations/**`, which apply the product role rules
 * before touching the database or calling `auth.api.*`. The organization
 * plugin endpoints apply only the access-control statements in
 * `permissions.ts`, so exposing them would bypass those rules.
 *
 * This is an allowlist: any organization endpoint not listed here, including
 * endpoints added by future Better Auth versions, is denied with HTTP 403.
 *
 * - `set-active`: the web app selects the active organization in the session.
 *   Better Auth only accepts organizations the caller is a member of.
 * - `accept-invitation` / `reject-invitation`: the invitee answers an
 *   invitation addressed to their own email. Invitations are created only by
 *   the product route.
 */
export const BROWSER_ORGANIZATION_ENDPOINTS: ReadonlySet<string> = new Set([
  "/organization/set-active",
  "/organization/accept-invitation",
  "/organization/reject-invitation",
]);

function isOrganizationEndpoint(path: string | undefined): boolean {
  return path === "/organization" || (path?.startsWith("/organization/") ?? false);
}

/**
 * Rejects direct HTTP calls to organization plugin endpoints outside
 * {@link BROWSER_ORGANIZATION_ENDPOINTS}.
 *
 * Server-side `auth.api.*` calls have no incoming `Request` and are not
 * affected: product routes authorize the caller before making them.
 */
export function rejectDirectOrganizationEndpoint(ctx: {
  path?: string;
  request?: Request;
}): void {
  if (!ctx.request) return;
  if (!isOrganizationEndpoint(ctx.path)) return;
  if (BROWSER_ORGANIZATION_ENDPOINTS.has(ctx.path!)) return;

  throw new APIError("FORBIDDEN", {
    message:
      "This organization operation is not available through the auth API. Use the /v1/organizations routes.",
  });
}
