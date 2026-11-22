/**
 * Unit tests for the authorization middlewares (#31) and the role/permission
 * helpers they rely on. The middlewares are invoked directly with a minimal
 * request/reply double; membership lookups use the disposable test database.
 */
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "@repo/infra/db";
import { member } from "@repo/infra/db/schema";
import {
  getAllRoles,
  hasMinimumRole,
  isValidRole,
  roleHasPermission,
  type RoleName,
} from "@repo/infra/auth";
import {
  requirePlatformAdmin,
  requirePlatformAdminOrOrgRole,
} from "../authorization";
import {
  addMember,
  createOrg,
  createUser,
} from "../../../test/helpers/factories";

type AuthUser = NonNullable<FastifyRequest["user"]>;

function fakeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: randomUUID(),
    email: "user@test.local",
    name: "User",
    image: null,
    emailVerified: true,
    isActive: true,
    isPlatformAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    activeOrganizationId: null,
    activeOrganizationName: null,
    role: null,
    ...overrides,
  } as AuthUser;
}

/** Runs a preHandler and returns the status it sent, or null when it passed. */
async function run(
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
  user: AuthUser | undefined,
  params: Record<string, string> = {},
): Promise<{ status: number | null; body: unknown }> {
  const sent: { status: number | null; body: unknown } = {
    status: null,
    body: undefined,
  };
  const reply = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    send(body: unknown) {
      sent.body = body;
      return this;
    },
  } as unknown as FastifyReply;
  await handler({ user, params } as unknown as FastifyRequest, reply);
  return sent;
}

describe("requirePlatformAdmin", () => {
  it("returns 401 without an authenticated user", async () => {
    expect((await run(requirePlatformAdmin(), undefined)).status).toBe(401);
  });

  it("returns 403 for organization admins who are not platform admins", async () => {
    const res = await run(
      requirePlatformAdmin(),
      fakeUser({ role: "admin", activeOrganizationId: randomUUID() }),
    );
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      message: "Platform admin access required",
    });
  });

  it("passes platform admins", async () => {
    const res = await run(
      requirePlatformAdmin(),
      fakeUser({ isPlatformAdmin: true }),
    );
    expect(res.status).toBeNull();
  });
});

describe("requirePlatformAdminOrOrgRole", () => {
  it("returns 401 without an authenticated user", async () => {
    const res = await run(requirePlatformAdminOrOrgRole("teacher"), undefined, {
      id: randomUUID(),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when the organization parameter is missing", async () => {
    const res = await run(requirePlatformAdminOrOrgRole("teacher"), fakeUser());
    expect(res.status).toBe(400);
  });

  it("honours a custom parameter name", async () => {
    const org = await createOrg();
    const usr = await createUser();
    await addMember(usr.id, org.id, "teacher");
    const res = await run(
      requirePlatformAdminOrOrgRole("teacher", { paramName: "orgId" }),
      fakeUser({ id: usr.id }),
      { orgId: org.id },
    );
    expect(res.status).toBeNull();
  });

  it("returns 404 for an unknown organization, even for platform admins", async () => {
    const res = await run(
      requirePlatformAdminOrOrgRole("teacher"),
      fakeUser({ isPlatformAdmin: true }),
      { id: randomUUID() },
    );
    expect(res.status).toBe(404);
  });

  it("passes platform admins without membership", async () => {
    const org = await createOrg();
    const res = await run(
      requirePlatformAdminOrOrgRole("admin"),
      fakeUser({ isPlatformAdmin: true }),
      { id: org.id },
    );
    expect(res.status).toBeNull();
  });

  it("returns 403 for non-members", async () => {
    const org = await createOrg();
    const usr = await createUser();
    const res = await run(
      requirePlatformAdminOrOrgRole("student"),
      fakeUser({ id: usr.id }),
      {
        id: org.id,
      },
    );
    expect(res.status).toBe(403);
  });

  it.each<[RoleName, RoleName, boolean]>([
    ["student", "teacher", false],
    ["teacher", "teacher", true],
    ["teacher", "coordinator", false],
    ["coordinator", "coordinator", true],
    ["admin", "coordinator", true],
  ])(
    "member role %s against minimum %s → allowed=%s",
    async (role, minimum, allowed) => {
      const org = await createOrg();
      const usr = await createUser();
      await addMember(usr.id, org.id, role);
      const res = await run(
        requirePlatformAdminOrOrgRole(minimum),
        fakeUser({ id: usr.id }),
        {
          id: org.id,
        },
      );
      expect(res.status).toBe(allowed ? null : 403);
    },
  );

  it("uses the role in the :id organization, not the active organization role", async () => {
    const target = await createOrg();
    const active = await createOrg();
    const usr = await createUser();
    await addMember(usr.id, target.id, "coordinator");
    await addMember(usr.id, active.id, "student");
    const allowed = await run(
      requirePlatformAdminOrOrgRole("coordinator"),
      fakeUser({
        id: usr.id,
        activeOrganizationId: active.id,
        role: "student",
      }),
      { id: target.id },
    );
    expect(allowed.status).toBeNull();

    const denied = await run(
      requirePlatformAdminOrOrgRole("coordinator"),
      fakeUser({
        id: usr.id,
        activeOrganizationId: target.id,
        role: "coordinator",
      }),
      { id: active.id },
    );
    expect(denied.status).toBe(403);
  });

  it("does not require an active organization", async () => {
    const org = await createOrg();
    const usr = await createUser();
    await addMember(usr.id, org.id, "teacher");
    const res = await run(
      requirePlatformAdminOrOrgRole("teacher"),
      fakeUser({ id: usr.id, activeOrganizationId: null, role: null }),
      { id: org.id },
    );
    expect(res.status).toBeNull();
  });

  it("treats the Better Auth owner role as admin", async () => {
    const org = await createOrg();
    const usr = await createUser();
    await db.insert(member).values({
      id: randomUUID(),
      userId: usr.id,
      organizationId: org.id,
      role: "owner",
    });
    const res = await run(
      requirePlatformAdminOrOrgRole("admin"),
      fakeUser({ id: usr.id }),
      {
        id: org.id,
      },
    );
    expect(res.status).toBeNull();
  });

  it("denies members of an inactive organization", async () => {
    const org = await createOrg({ isActive: false });
    const usr = await createUser();
    await addMember(usr.id, org.id, "admin");
    const res = await run(
      requirePlatformAdminOrOrgRole("teacher"),
      fakeUser({ id: usr.id }),
      {
        id: org.id,
      },
    );
    expect(res.status).toBe(403);
  });
});

describe("role and permission helpers", () => {
  it("orders roles student < teacher < coordinator < admin", () => {
    expect(getAllRoles()).toEqual([
      "student",
      "teacher",
      "coordinator",
      "admin",
    ]);
    expect(hasMinimumRole("teacher", "student")).toBe(true);
    expect(hasMinimumRole("teacher", "coordinator")).toBe(false);
    expect(hasMinimumRole("admin", "admin")).toBe(true);
  });

  it("validates role names", () => {
    expect(isValidRole("coordinator")).toBe(true);
    expect(isValidRole("owner")).toBe(false);
    expect(isValidRole("member")).toBe(false);
  });

  it("maps the access-control statements per role", () => {
    expect(roleHasPermission("student", "knowledgeBase", "create")).toBe(false);
    expect(roleHasPermission("student", "challenge", "update")).toBe(false);
    expect(roleHasPermission("teacher", "challenge", "update")).toBe(true);
    expect(roleHasPermission("teacher", "knowledgeBase", "delete")).toBe(true);
    expect(roleHasPermission("teacher", "classroom", "delete")).toBe(false);
    expect(roleHasPermission("teacher", "invitation", "cancel")).toBe(false);
    expect(roleHasPermission("coordinator", "organization", "delete")).toBe(
      false,
    );
    expect(roleHasPermission("admin", "organization", "delete")).toBe(true);
  });
});
