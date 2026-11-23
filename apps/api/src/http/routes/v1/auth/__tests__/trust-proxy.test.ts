import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// One trusted proxy in front of the API (TRUST_PROXY=<its address>): the
// client IP is the X-Forwarded-For entry the proxy appended, never a
// client-chosen one.
vi.hoisted(() => {
  process.env.TRUST_PROXY = "10.0.0.2";
  process.env.AUTH_RATE_LIMIT_ENABLED = "true";
  process.env.AUTH_RATE_LIMIT_SIGN_IN_PER_MINUTE = "5";
});

import { parseTrustProxy } from "@repo/infra/env";
import { getApp } from "../../../../../test/helpers/app";
import { rateLimitSettings } from "../../../../middlewares/rate-limit";

const PROXY = "10.0.0.2";
const defaults = structuredClone(rateLimitSettings);

describe("TRUST_PROXY", () => {
  it("parses false and address lists, and rejects true and hop counts", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("10.0.0.0/8, uniquelocal")).toEqual([
      "10.0.0.0/8",
      "uniquelocal",
    ]);
    expect(() => parseTrustProxy("true")).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy("1")).toThrow(/TRUST_PROXY/);
  });
});

describe("client IP behind one trusted proxy", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  afterEach(() => {
    Object.assign(rateLimitSettings, structuredClone(defaults));
  });

  // The client sends "spoofed"; the proxy appends the address it saw.
  const viaProxy = (spoofed: string, real: string) => ({
    remoteAddress: PROXY,
    headers: { "x-forwarded-for": `${spoofed}, ${real}` },
  });

  const signIn = (spoofed: string, real: string) =>
    app.inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      ...viaProxy(spoofed, real),
      payload: { email: "nobody@test.local", password: "wrong-password" },
    });

  it("limits sign-in by the proxy-appended entry, not the spoofed one", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await signIn(`198.51.100.${i}`, "203.0.113.40")).statusCode).toBe(
        401
      );
    }
    expect((await signIn("198.51.100.99", "203.0.113.40")).statusCode).toBe(429);
    // A different real client keeps its own budget.
    expect((await signIn("198.51.100.99", "203.0.113.41")).statusCode).toBe(401);
  });

  it("keys anonymous API requests by the proxy-appended entry", async () => {
    rateLimitSettings.globalPerMinute = 2;
    const status = (spoofed: string, real: string) =>
      app.inject({ url: "/v1/status", ...viaProxy(spoofed, real) });

    expect((await status("198.51.100.1", "203.0.113.50")).statusCode).toBe(200);
    expect((await status("198.51.100.2", "203.0.113.50")).statusCode).toBe(200);
    expect((await status("198.51.100.3", "203.0.113.50")).statusCode).toBe(429);
    expect((await status("198.51.100.3", "203.0.113.51")).statusCode).toBe(200);
  });

  it("ignores X-Forwarded-For from a client that is not the proxy", async () => {
    rateLimitSettings.globalPerMinute = 2;
    const direct = (xff: string) =>
      app.inject({
        url: "/v1/status",
        remoteAddress: "203.0.113.60",
        headers: { "x-forwarded-for": xff },
      });

    expect((await direct("198.51.100.1")).statusCode).toBe(200);
    expect((await direct("198.51.100.2")).statusCode).toBe(200);
    expect((await direct("198.51.100.3")).statusCode).toBe(429);
  });
});
