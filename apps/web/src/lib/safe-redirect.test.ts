import { describe, expect, it } from "vitest";
import { authPageHref, getSafeRedirect } from "./safe-redirect";

describe("getSafeRedirect", () => {
  it.each([
    "/dashboard",
    "/auth/accept-invitation?id=abc",
    "/classrooms/1#top",
    "/%2f%2fevil.com",
    "/%5cevil.com",
  ])("keeps the same-origin path %s", (raw) => {
    expect(getSafeRedirect(raw)).toBe(raw);
  });

  it("returns the normalised path", () => {
    expect(getSafeRedirect("/a/../dashboard")).toBe("/dashboard");
  });

  it.each([
    null,
    undefined,
    "",
    "dashboard",
    "https://evil.com",
    "javascript:alert(1)",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    // Dot segments collapse to a protocol-relative URL once resolved.
    "/.//evil.com",
    "/..//evil.com",
    "/a/../..//evil.com",
    "/./\\evil.com",
    // Browsers strip tabs and newlines from URLs before parsing them.
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
  ])("rejects %j", (raw) => {
    expect(getSafeRedirect(raw)).toBeNull();
  });

  it("never returns a path that resolves to another origin", () => {
    const payloads = [
      "/.//evil.com",
      "/..//evil.com",
      "/a/../..//evil.com",
      "/%2e//evil.com",
      "/%2e%2e//evil.com",
      "/.%2f/evil.com",
    ];
    for (const raw of payloads) {
      const safe = getSafeRedirect(raw);
      if (safe === null) continue;
      expect(new URL(safe, "https://app.example").origin).toBe(
        "https://app.example"
      );
    }
  });
});

describe("authPageHref", () => {
  it("drops unsafe redirects", () => {
    expect(authPageHref("login", { redirect: "/.//evil.com" })).toBe(
      "/auth/login"
    );
  });

  it("keeps safe redirects and the email", () => {
    expect(
      authPageHref("signup", {
        redirect: "/auth/accept-invitation?id=abc",
        email: "a@b.test",
      })
    ).toBe(
      "/auth/signup?redirect=%2Fauth%2Faccept-invitation%3Fid%3Dabc&email=a%40b.test"
    );
  });
});
