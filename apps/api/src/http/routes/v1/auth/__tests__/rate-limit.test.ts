import { beforeAll, describe, expect, it, vi } from "vitest";

// Better Auth reads its limits when the auth module loads, and they are off
// by default under NODE_ENV=test. Turn them on for this file only.
vi.hoisted(() => {
  process.env.AUTH_RATE_LIMIT_ENABLED = "true";
  process.env.AUTH_RATE_LIMIT_SIGN_IN_PER_MINUTE = "5";
});

import { getApp } from "../../../../../test/helpers/app";

describe("Better Auth rate limits", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  const signIn = (prefix: "/v1" | "/api", ip: string) =>
    app.inject({
      method: "POST",
      url: `${prefix}/auth/sign-in/email`,
      headers: { "x-forwarded-for": ip },
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
    const spoofed = await app.inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "x-taco-client-ip": "198.51.100.1",
      },
      payload: { email: "nobody@test.local", password: "wrong-password" },
    });
    expect(spoofed.statusCode).toBe(429);
  });
});
