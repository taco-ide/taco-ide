import { beforeAll, describe, expect, it } from "vitest";
import { APIError } from "@repo/infra/auth";
import app from "../server";

app.get("/v1/auth/test-internal-error", async () => {
  throw new Error("database host and private query must remain internal");
});
app.get("/v1/auth/test-auth-internal-error", async () => {
  throw new APIError("INTERNAL_SERVER_ERROR", {
    message: "private authentication backend detail",
  });
});
app.get("/v1/auth/test-auth-forbidden", async () => {
  throw new APIError("FORBIDDEN", { message: "Access denied" });
});

describe("public error responses", () => {
  beforeAll(async () => {
    await app.ready();
  });
  it.each(["internal-error", "auth-internal-error"])(
    "hides backend details from %s",
    async (route) => {
      const response = await app.inject({ url: `/v1/auth/test-${route}` });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        success: false,
        message: "Internal Server Error",
      });
    }
  );
  it("preserves actionable auth 4xx messages", async () => {
    const response = await app.inject({ url: "/v1/auth/test-auth-forbidden" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      success: false,
      message: "Access denied",
    });
  });
});
