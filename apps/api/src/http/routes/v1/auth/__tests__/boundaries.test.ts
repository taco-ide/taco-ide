import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { auth } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { member, organization, user } from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createOrg,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

const administrativeInputs = [
  { isActive: true },
  { isActive: false },
  { deletedAt: "2026-10-01T00:00:00.000Z" },
  { deletedAt: null },
  { isPlatformAdmin: true },
  { isPlatformAdmin: false },
];

for (const prefix of ["/api/auth", "/v1/auth"]) {
  describe(`self-service boundaries through ${prefix}`, () => {
    let app: Awaited<ReturnType<typeof getApp>>;

    beforeAll(async () => {
      app = await getApp();
    });

    it("preserves normal signup with server-controlled defaults", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${prefix}/sign-up/email`,
        payload: {
          name: "New user",
          email: "signup@test.local",
          password: TEST_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["set-cookie"]).toBeDefined();
      const [created] = await db.select().from(user).where(eq(user.email, "signup@test.local"));
      expect(created).toMatchObject({ isActive: true, deletedAt: null, isPlatformAdmin: false });
    });

    it.each(administrativeInputs)("rejects administrative signup input %j without creating a user", async (input) => {
      const response = await app.inject({
        method: "POST",
        url: `${prefix}/sign-up/email`,
        payload: {
          name: "New user",
          email: "signup@test.local",
          password: TEST_PASSWORD,
          ...input,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(await db.select().from(user).where(eq(user.email, "signup@test.local"))).toHaveLength(0);
    });

    it("preserves normal profile updates for active accounts", async () => {
      const actor = await createUser();
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });
      const response = await app.inject({
        method: "POST",
        url: `${prefix}/update-user`,
        headers: { cookie },
        payload: { name: "Updated name" },
      });

      expect(response.statusCode).toBe(200);
      const [updated] = await db.select().from(user).where(eq(user.id, actor.id));
      expect(updated?.name).toBe("Updated name");
    });

    it.each(administrativeInputs)("rejects administrative self-update input %j atomically", async (input) => {
      const actor = await createUser();
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });
      const response = await app.inject({
        method: "POST",
        url: `${prefix}/update-user`,
        headers: { cookie },
        payload: { name: "Should not change", ...input },
      });

      expect(response.statusCode).toBe(400);
      const [unchanged] = await db.select().from(user).where(eq(user.id, actor.id));
      expect(unchanged).toMatchObject({
        name: actor.name,
        isActive: true,
        deletedAt: null,
        isPlatformAdmin: false,
      });
    });

    it("blocks profile writes after the account is disabled despite an existing cookie", async () => {
      const actor = await createUser();
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });
      await db.update(user).set({ isActive: false }).where(eq(user.id, actor.id));

      const response = await app.inject({
        method: "POST",
        url: `${prefix}/update-user`,
        headers: { cookie },
        payload: { name: "Should not change" },
      });

      expect(response.statusCode).toBe(403);
      const [unchanged] = await db.select().from(user).where(eq(user.id, actor.id));
      expect(unchanged).toMatchObject({ name: actor.name, isActive: false });
    });

    it("does not reactivate an account or clear its deletion timestamp through self-update", async () => {
      const actor = await createUser();
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });
      const deletedAt = new Date("2026-10-01T00:00:00.000Z");
      await db.update(user).set({ isActive: false, deletedAt }).where(eq(user.id, actor.id));

      const response = await app.inject({
        method: "POST",
        url: `${prefix}/update-user`,
        headers: { cookie },
        payload: { isActive: true, deletedAt: null },
      });

      expect(response.statusCode).toBe(400);
      const [unchanged] = await db.select().from(user).where(eq(user.id, actor.id));
      expect(unchanged).toMatchObject({ isActive: false, deletedAt });
    });

    it("requires authentication to update a profile", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${prefix}/update-user`,
        payload: { name: "Updated name" },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe(`organization creation boundaries through ${prefix}`, () => {
    let app: Awaited<ReturnType<typeof getApp>>;

    beforeAll(async () => {
      app = await getApp();
    });

    async function requestCreation(cookie?: string) {
      return app.inject({
        method: "POST",
        url: `${prefix}/organization/create`,
        headers: cookie ? { cookie } : {},
        payload: { name: "New organization", slug: "new-organization" },
      });
    }

    it("requires authentication", async () => {
      expect((await requestCreation()).statusCode).toBe(401);
      expect(await db.select().from(organization)).toHaveLength(0);
    });

    it("denies organization admins without platform privileges", async () => {
      const actor = await createUser();
      const existingOrg = await createOrg();
      await addMember(actor.id, existingOrg.id, "admin");
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });

      expect((await requestCreation(cookie)).statusCode).toBe(403);
      expect(await db.select().from(organization).where(eq(organization.slug, "new-organization"))).toHaveLength(0);
    });

    it("allows an active platform admin and retains the creator's admin membership", async () => {
      const actor = await createUser({ isPlatformAdmin: true });
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });

      expect((await requestCreation(cookie)).statusCode).toBe(200);
      const [created] = await db.select().from(organization).where(eq(organization.slug, "new-organization"));
      expect(created?.isActive).toBe(true);
      const memberships = await db.select().from(member).where(eq(member.organizationId, created!.id));
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ userId: actor.id, role: "admin" });
    });

    it("uses current privileges after promotion instead of stale session claims", async () => {
      const actor = await createUser();
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });
      await db.update(user).set({ isPlatformAdmin: true }).where(eq(user.id, actor.id));

      expect((await requestCreation(cookie)).statusCode).toBe(200);
    });

    it.each([
      { isPlatformAdmin: false },
      { isActive: false },
      { deletedAt: new Date("2026-10-01T00:00:00.000Z") },
    ])("denies revoked eligibility %j despite an existing admin cookie", async (changes) => {
      const actor = await createUser({ isPlatformAdmin: true });
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });
      await db.update(user).set(changes).where(eq(user.id, actor.id));

      expect((await requestCreation(cookie)).statusCode).toBe(403);
      expect(await db.select().from(organization)).toHaveLength(0);
      expect(await db.select().from(member)).toHaveLength(0);
    });
  });
}

describe("server-side organization creation", () => {
  it("applies the same policy to server-only userId calls", async () => {
    const actor = await createUser();
    const response = await auth.api.createOrganization({
      body: { userId: actor.id, name: "New organization", slug: "new-organization" },
      asResponse: true,
    });

    expect(response.status).toBe(403);
    expect(await db.select().from(organization)).toHaveLength(0);
  });
});
