/**
 * Test auth helpers.
 *
 * Goal: produce a `Cookie` header value that the Better Auth middleware
 * will accept when the test injects a request into the Fastify app.
 *
 * Implementation: call `auth.api.signInEmail({ asResponse: true })` to log
 * in a real seeded user, then extract the `Set-Cookie` header from the
 * Response. This guarantees we use whatever signing/encoding scheme
 * Better Auth currently uses without re-implementing it.
 */
import { auth } from "@repo/infra/auth";

export interface LoginOptions {
  email: string;
  password: string;
}

/**
 * Sign in an existing test user and return the cookie header value
 * suitable for use in `fastify.inject({ headers: { cookie: ... } })`.
 *
 * Throws if the credentials don't match or the user is disabled.
 */
export async function loginAs({ email, password }: LoginOptions): Promise<string> {
  const response = (await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  })) as Response;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `signInEmail failed (${response.status}) for ${email}: ${body}`
    );
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error(`signInEmail returned no Set-Cookie for ${email}`);
  }

  // Set-Cookie may contain multiple cookies separated by commas in some Node
  // versions (Headers.get joins them). Each cookie has the form
  // `name=value; Path=/; HttpOnly; ...`. For the Cookie header we only need
  // `name=value` pairs joined by `; `.
  const cookieHeader = setCookie
    .split(/,(?=[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");

  return cookieHeader;
}

/**
 * After login, set the active organization on the session so the auth
 * middleware can resolve the user's role for that org. Returns an updated
 * cookie (Better Auth may rotate session metadata).
 */
export async function setActiveOrg(opts: {
  cookie: string;
  organizationId: string;
}): Promise<string> {
  const response = (await auth.api.setActiveOrganization({
    body: { organizationId: opts.organizationId },
    headers: new Headers({ cookie: opts.cookie }),
    asResponse: true,
  })) as Response;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `setActiveOrganization failed (${response.status}): ${body}`
    );
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return opts.cookie;
  const fresh = setCookie
    .split(/,(?=[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
  return fresh || opts.cookie;
}
