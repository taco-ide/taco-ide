import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auth, roleHasPermission } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { invitation, member, organization, user } from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs, setActiveOrg } from "../../../../../test/helpers/auth";
import {
  addMember,
  createOrg,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

type Role = "student" | "teacher" | "coordinator" | "admin";
type App = Awaited<ReturnType<typeof getApp>>;

async function memberWithSession(orgId: string, role: Role) {
  const actor = await createUser();
  await addMember(actor.id, orgId, role);
  const cookie = await setActiveOrg({
    cookie: await loginAs({ email: actor.email, password: TEST_PASSWORD }),
    organizationId: orgId,
  });
  return { actor, cookie };
}

async function platformAdminSession() {
  const actor = await createUser({ isPlatformAdmin: true });
  const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });
  return { actor, cookie };
}

async function createPendingInvitation(opts: {
  orgId: string;
  inviterId: string;
  email: string;
  role?: Role;
}) {
  const [row] = await db
    .insert(invitation)
    .values({
      id: randomUUID(),
      email: opts.email,
      inviterId: opts.inviterId,
      organizationId: opts.orgId,
      role: opts.role ?? "student",
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })
    .returning();
  return row!;
}

async function roleOf(orgId: string, userId: string) {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
  return row?.role;
}

for (const prefix of ["/api/auth", "/v1/auth"]) {
  describe(`direct Better Auth organization endpoints through ${prefix}`, () => {
    let app: App;

    beforeAll(async () => {
      app = await getApp();
    });

    function call(path: string, cookie: string, payload?: Record<string, unknown>) {
      return app.inject({
        method: payload ? "POST" : "GET",
        url: `${prefix}/organization/${path}`,
        headers: { cookie },
        ...(payload ? { payload } : {}),
      });
    }

    it("denies a teacher inviting a coordinator", async () => {
      const org = await createOrg();
      const { cookie } = await memberWithSession(org.id, "teacher");

      const response = await call("invite-member", cookie, {
        email: "invitee@test.local",
        role: "coordinator",
        organizationId: org.id,
      });

      expect(response.statusCode).toBe(403);
      expect(await db.select().from(invitation)).toHaveLength(0);
    });

    it("denies a coordinator inviting through the plugin", async () => {
      const org = await createOrg();
      const { cookie } = await memberWithSession(org.id, "coordinator");

      const response = await call("invite-member", cookie, {
        email: "invitee@test.local",
        role: "student",
        organizationId: org.id,
      });

      expect(response.statusCode).toBe(403);
      expect(await db.select().from(invitation)).toHaveLength(0);
    });

    it("denies a coordinator removing a member", async () => {
      const org = await createOrg();
      const { cookie } = await memberWithSession(org.id, "coordinator");
      const target = await createUser();
      const targetMember = await addMember(target.id, org.id, "student");

      const response = await call("remove-member", cookie, {
        memberIdOrEmail: targetMember.id,
        organizationId: org.id,
      });

      expect(response.statusCode).toBe(403);
      expect(await roleOf(org.id, target.id)).toBe("student");
    });

    it("denies a coordinator updating the organization", async () => {
      const org = await createOrg({ name: "Original name" });
      const { cookie } = await memberWithSession(org.id, "coordinator");

      const response = await call("update", cookie, {
        organizationId: org.id,
        data: { name: "Hijacked" },
      });

      expect(response.statusCode).toBe(403);
      const [row] = await db.select().from(organization).where(eq(organization.id, org.id));
      expect(row?.name).toBe("Original name");
    });

    it("denies an organization admin deleting the organization", async () => {
      const org = await createOrg();
      const { cookie } = await memberWithSession(org.id, "admin");

      const response = await call("delete", cookie, { organizationId: org.id });

      expect(response.statusCode).toBe(403);
      expect(await db.select().from(organization).where(eq(organization.id, org.id))).toHaveLength(1);
    });

    it("denies an organization admin changing roles through the plugin", async () => {
      const org = await createOrg();
      const { cookie } = await memberWithSession(org.id, "admin");
      const target = await createUser();
      const targetMember = await addMember(target.id, org.id, "student");

      const response = await call("update-member-role", cookie, {
        memberId: targetMember.id,
        role: "coordinator",
        organizationId: org.id,
      });

      expect(response.statusCode).toBe(403);
      expect(await roleOf(org.id, target.id)).toBe("student");
    });

    it("denies an organization admin cancelling an invitation through the plugin", async () => {
      const org = await createOrg();
      const { actor, cookie } = await memberWithSession(org.id, "admin");
      const pending = await createPendingInvitation({
        orgId: org.id,
        inviterId: actor.id,
        email: "invitee@test.local",
      });

      const response = await call("cancel-invitation", cookie, { invitationId: pending.id });

      expect(response.statusCode).toBe(403);
      const [row] = await db.select().from(invitation).where(eq(invitation.id, pending.id));
      expect(row?.status).toBe("pending");
    });

    it("denies a member leaving the organization through the plugin", async () => {
      const org = await createOrg();
      const { actor, cookie } = await memberWithSession(org.id, "student");

      const response = await call("leave", cookie, { organizationId: org.id });

      expect(response.statusCode).toBe(403);
      expect(await roleOf(org.id, actor.id)).toBe("student");
    });

    it("denies platform admins too: the admin panel uses product routes", async () => {
      const { cookie } = await platformAdminSession();

      const response = await call("create", cookie, {
        name: "New organization",
        slug: "new-organization",
      });

      expect(response.statusCode).toBe(403);
      expect(await db.select().from(organization)).toHaveLength(0);
    });

    it.each([
      "get-full-organization",
      "list",
      "list-members",
      "list-invitations",
      "get-active-member",
    ])("denies the unused read endpoint %s", async (path) => {
      const org = await createOrg();
      const { cookie } = await memberWithSession(org.id, "student");

      expect((await call(path, cookie)).statusCode).toBe(403);
    });

    it("denies unauthenticated callers", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${prefix}/organization/invite-member`,
        payload: { email: "invitee@test.local", role: "student" },
      });
      expect(response.statusCode).toBe(403);
    });

    it("allows a member to set their active organization", async () => {
      const org = await createOrg();
      const actor = await createUser();
      await addMember(actor.id, org.id, "student");
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });

      const response = await call("set-active", cookie, { organizationId: org.id });

      expect(response.statusCode).toBe(200);
    });

    it("still refuses set-active for an organization the caller does not belong to", async () => {
      const org = await createOrg();
      const actor = await createUser();
      const cookie = await loginAs({ email: actor.email, password: TEST_PASSWORD });

      const response = await call("set-active", cookie, { organizationId: org.id });

      expect(response.statusCode).toBe(403);
    });

    it("allows the invitee to accept an invitation", async () => {
      const org = await createOrg();
      const inviter = await createUser();
      await addMember(inviter.id, org.id, "coordinator");
      const invitee = await createUser();
      const pending = await createPendingInvitation({
        orgId: org.id,
        inviterId: inviter.id,
        email: invitee.email,
        role: "teacher",
      });
      const cookie = await loginAs({ email: invitee.email, password: TEST_PASSWORD });

      const response = await call("accept-invitation", cookie, { invitationId: pending.id });

      expect(response.statusCode).toBe(200);
      expect(await roleOf(org.id, invitee.id)).toBe("teacher");
      const [row] = await db.select().from(invitation).where(eq(invitation.id, pending.id));
      expect(row?.status).toBe("accepted");
    });

    it("allows the invitee to reject an invitation", async () => {
      const org = await createOrg();
      const inviter = await createUser();
      await addMember(inviter.id, org.id, "coordinator");
      const invitee = await createUser();
      const pending = await createPendingInvitation({
        orgId: org.id,
        inviterId: inviter.id,
        email: invitee.email,
      });
      const cookie = await loginAs({ email: invitee.email, password: TEST_PASSWORD });

      const response = await call("reject-invitation", cookie, { invitationId: pending.id });

      expect(response.statusCode).toBe(200);
      expect(await roleOf(org.id, invitee.id)).toBeUndefined();
      const [row] = await db.select().from(invitation).where(eq(invitation.id, pending.id));
      expect(row?.status).toBe("rejected");
    });
  });
}

describe("organization plugin configuration", () => {
  it("disables organization deletion even for server-side calls", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "admin");

    const response = await auth.api.deleteOrganization({
      body: { organizationId: org.id },
      headers: new Headers({ cookie }),
      asResponse: true,
    });

    expect(response.ok).toBe(false);
    expect(await db.select().from(organization).where(eq(organization.id, org.id))).toHaveLength(1);
  });

  it("matches role statements to product rules", () => {
    expect(roleHasPermission("teacher", "invitation", "create")).toBe(false);
    expect(roleHasPermission("teacher", "member", "create")).toBe(false);
    for (const role of ["coordinator", "admin"] as const) {
      expect(roleHasPermission(role, "invitation", "create")).toBe(true);
      expect(roleHasPermission(role, "invitation", "cancel")).toBe(true);
      expect(roleHasPermission(role, "member", "update")).toBe(true);
      expect(roleHasPermission(role, "member", "delete")).toBe(false);
      expect(roleHasPermission(role, "organization", "update")).toBe(false);
      expect(roleHasPermission(role, "organization", "delete")).toBe(false);
    }
  });
});

describe("product invitation routes keep working", () => {
  let app: App;

  beforeAll(async () => {
    app = await getApp();
  });

  function invite(orgId: string, cookie: string, role: Role) {
    return app.inject({
      method: "POST",
      url: `/v1/organizations/${orgId}/invitations`,
      headers: { cookie },
      payload: { email: "invitee@test.local", role },
    });
  }

  it("lets a coordinator invite and cancel through the product routes", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "coordinator");

    const created = await invite(org.id, cookie, "teacher");
    expect(created.statusCode).toBe(201);
    const invitationId = created.json().data.id as string;

    const cancelled = await app.inject({
      method: "DELETE",
      url: `/v1/organizations/${org.id}/invitations/${invitationId}`,
      headers: { cookie },
    });
    expect(cancelled.statusCode).toBe(200);
    const [row] = await db.select().from(invitation).where(eq(invitation.id, invitationId));
    expect(row?.status).toBe("canceled");
  });

  it("denies a teacher inviting through the product route", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "teacher");

    expect((await invite(org.id, cookie, "coordinator")).statusCode).toBe(403);
    expect(await db.select().from(invitation)).toHaveLength(0);
  });

  it("denies a coordinator inviting an admin", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "coordinator");

    expect((await invite(org.id, cookie, "admin")).statusCode).toBe(403);
    expect(await db.select().from(invitation)).toHaveLength(0);
  });
});

describe("PUT /v1/organizations/:id/members/:userId admin role changes", () => {
  let app: App;

  beforeAll(async () => {
    app = await getApp();
  });

  function updateRole(orgId: string, userId: string, cookie: string, role: Role) {
    return app.inject({
      method: "PUT",
      url: `/v1/organizations/${orgId}/members/${userId}`,
      headers: { cookie },
      payload: { role },
    });
  }

  async function orgWithTwoAdmins() {
    const org = await createOrg();
    const adminA = await createUser();
    const adminB = await createUser();
    await addMember(adminA.id, org.id, "admin");
    await addMember(adminB.id, org.id, "admin");
    return { org, adminA, adminB };
  }

  it("denies a coordinator demoting an admin even when another admin remains", async () => {
    const { org, adminA } = await orgWithTwoAdmins();
    const { cookie } = await memberWithSession(org.id, "coordinator");

    const response = await updateRole(org.id, adminA.id, cookie, "student");

    expect(response.statusCode).toBe(403);
    expect(await roleOf(org.id, adminA.id)).toBe("admin");
  });

  it("denies a coordinator promoting a member to admin", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "coordinator");
    const target = await createUser();
    await addMember(target.id, org.id, "teacher");

    const response = await updateRole(org.id, target.id, cookie, "admin");

    expect(response.statusCode).toBe(403);
    expect(await roleOf(org.id, target.id)).toBe("teacher");
  });

  it("lets a coordinator change non-admin roles", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "coordinator");
    const target = await createUser();
    await addMember(target.id, org.id, "student");

    const response = await updateRole(org.id, target.id, cookie, "teacher");

    expect(response.statusCode).toBe(200);
    expect(await roleOf(org.id, target.id)).toBe("teacher");
  });

  it("lets an organization admin demote another admin", async () => {
    const { org, adminA, adminB } = await orgWithTwoAdmins();
    const cookie = await setActiveOrg({
      cookie: await loginAs({ email: adminB.email, password: TEST_PASSWORD }),
      organizationId: org.id,
    });

    const response = await updateRole(org.id, adminA.id, cookie, "coordinator");

    expect(response.statusCode).toBe(200);
    expect(await roleOf(org.id, adminA.id)).toBe("coordinator");
  });

  it("uses the current membership, not a stale admin session", async () => {
    const { org, adminA, adminB } = await orgWithTwoAdmins();
    const cookie = await setActiveOrg({
      cookie: await loginAs({ email: adminB.email, password: TEST_PASSWORD }),
      organizationId: org.id,
    });
    await db
      .update(member)
      .set({ role: "coordinator" })
      .where(and(eq(member.organizationId, org.id), eq(member.userId, adminB.id)));

    const response = await updateRole(org.id, adminA.id, cookie, "student");

    expect(response.statusCode).toBe(403);
    expect(await roleOf(org.id, adminA.id)).toBe("admin");
  });

  it("lets a platform admin promote and demote admins", async () => {
    const { org, adminA } = await orgWithTwoAdmins();
    const { cookie } = await platformAdminSession();
    const target = await createUser();
    await addMember(target.id, org.id, "teacher");

    expect((await updateRole(org.id, target.id, cookie, "admin")).statusCode).toBe(200);
    expect(await roleOf(org.id, target.id)).toBe("admin");
    expect((await updateRole(org.id, adminA.id, cookie, "teacher")).statusCode).toBe(200);
    expect(await roleOf(org.id, adminA.id)).toBe("teacher");
  });
});

describe("POST /v1/organizations/:id/members/import-csv admin rows", () => {
  let app: App;

  beforeAll(async () => {
    app = await getApp();
  });

  function importCsv(orgId: string, cookie: string, csv: string, dryRun = false) {
    const boundary = `----taco${randomUUID()}`;
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="members.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `${csv}\r\n` +
      `--${boundary}--\r\n`;
    return app.inject({
      method: "POST",
      url: `/v1/organizations/${orgId}/members/import-csv${dryRun ? "?dryRun=true" : ""}`,
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
  }

  const adminCsv = "name,email,role\nNew Admin,new-admin@test.local,admin\nNew Student,new-student@test.local,student\n";

  it.each([false, true])("denies a coordinator importing admin rows (dryRun=%s)", async (dryRun) => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "coordinator");

    const response = await importCsv(org.id, cookie, adminCsv, dryRun);

    expect(response.statusCode).toBe(403);
    expect(await db.select().from(user).where(eq(user.email, "new-admin@test.local"))).toHaveLength(0);
    expect(await db.select().from(user).where(eq(user.email, "new-student@test.local"))).toHaveLength(0);
  });

  it("denies a coordinator linking an existing user as admin", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "coordinator");
    const existing = await createUser();

    const response = await importCsv(org.id, cookie, `name,email,role\nExisting,${existing.email},admin\n`);

    expect(response.statusCode).toBe(403);
    expect(await roleOf(org.id, existing.id)).toBeUndefined();
  });

  it("lets a coordinator import non-admin rows", async () => {
    const org = await createOrg();
    const { cookie } = await memberWithSession(org.id, "coordinator");

    const response = await importCsv(org.id, cookie, "name,email,role\nNew Teacher,new-teacher@test.local,teacher\n");

    expect(response.statusCode).toBe(200);
    const [created] = await db.select().from(user).where(eq(user.email, "new-teacher@test.local"));
    expect(await roleOf(org.id, created!.id)).toBe("teacher");
  });

  it.each(["organization admin", "platform admin"])("lets a %s import admin rows", async (caller) => {
    const org = await createOrg();
    const { cookie } =
      caller === "platform admin" ? await platformAdminSession() : await memberWithSession(org.id, "admin");

    const response = await importCsv(org.id, cookie, adminCsv);

    expect(response.statusCode).toBe(200);
    const [created] = await db.select().from(user).where(eq(user.email, "new-admin@test.local"));
    expect(await roleOf(org.id, created!.id)).toBe("admin");
  });
});
