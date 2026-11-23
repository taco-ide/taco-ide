import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Better Auth reads its limits when the auth module loads, and they are off
// by default under NODE_ENV=test. Turn them on for this file only.
// TRUST_PROXY stays unset (the default): no proxy is trusted.
vi.hoisted(() => {
  process.env.AUTH_RATE_LIMIT_ENABLED = "true";
  process.env.AUTH_RATE_LIMIT_SIGN_IN_PER_MINUTE = "5";
  delete process.env.TRUST_PROXY;
});

import { getApp } from "../../../../../test/helpers/app";
import { rateLimitSettings } from "../../../../middlewares/rate-limit";

const defaults = structuredClone(rateLimitSettings);

describe("Better Auth rate limits", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  afterEach(() => {
    Object.assign(rateLimitSettings, structuredClone(defaults));
  });

  const signIn = (
    prefix: "/v1" | "/api",
    remoteAddress: string,
    headers: Record<string, string> = {}
  ) =>
    app.inject({
      method: "POST",
      url: `${prefix}/auth/sign-in/email`,
      remoteAddress,
      headers,
      payload: { email: "nobody@test.local", password: "wrong-password" },
    });

  it("limits sign-in attempts per client IP with the configured budget", async () => {
    // 5 exceeds Better Auth's built-in 3 per 10 s, proving our rule applies.
    for (let i = 0; i < 5; i++) {
      expect((await signIn("/v1", "203.0.113.10")).statusCode).toBe(401);
    }
    const limited = await signIn("/api", "203.0.113.10");
    expect(limited.statusCode).toBe(429);
    // One-minute window, not the built-in 10 s one.
    expect(Number(limited.headers["x-retry-after"])).toBeGreaterThan(10);

    // Other clients have their own budget, and a client-sent
    // x-taco-client-ip header is overwritten by the bridge.
    expect((await signIn("/v1", "203.0.113.11")).statusCode).toBe(401);
    const spoofed = await signIn("/v1", "203.0.113.10", {
      "x-taco-client-ip": "198.51.100.1",
    });
    expect(spoofed.statusCode).toBe(429);
  });

  it("ignores X-Forwarded-For when no proxy is trusted", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await signIn("/v1", "203.0.113.20", {
        "x-forwarded-for": `198.51.100.${i}`,
      });
      expect(res.statusCode).toBe(401);
    }
    const limited = await signIn("/v1", "203.0.113.20", {
      "x-forwarded-for": "198.51.100.99",
    });
    expect(limited.statusCode).toBe(429);
  });

  it("keys anonymous API requests by socket address, not X-Forwarded-For", async () => {
    rateLimitSettings.globalPerMinute = 2;
    const status = (xff: string) =>
      app.inject({
        url: "/v1/status",
        remoteAddress: "203.0.113.30",
        headers: { "x-forwarded-for": xff },
      });

    expect((await status("198.51.100.1")).statusCode).toBe(200);
    expect((await status("198.51.100.2")).statusCode).toBe(200);
    expect((await status("198.51.100.3")).statusCode).toBe(429);
  });
});
