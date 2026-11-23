import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  invitation,
  member,
  organizationEmailDomain,
  session,
  user,
} from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createOrg,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

type App = Awaited<ReturnType<typeof getApp>>;

const DAY_MS = 24 * 60 * 60 * 1000;

async function insertInvitation(overrides: {
  organizationId: string;
  inviterId: string;
  email: string;
  role?: string;
  status?: string;
  expiresAt?: Date;
}) {
  const [row] = await db
    .insert(invitation)
    .values({
      id: randomUUID(),
      email: overrides.email,
      inviterId: overrides.inviterId,
      organizationId: overrides.organizationId,
      role: overrides.role ?? "teacher",
      status: overrides.status ?? "pending",
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * DAY_MS),
    })
    .returning();
  return row!;
}

function cookieFrom(setCookie: string | string[] | undefined): string {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return values.map((c) => c.split(";")[0]!.trim()).join("; ");
}

async function signUp(app: App, email: string, name = "Invited Person") {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    payload: { name, email, password: TEST_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  return cookieFrom(response.headers["set-cookie"]);
}

describe("GET /v1/invitations/:id (public preview)", () => {
  let app: App;

  beforeAll(async () => {
    app = await getApp();
  });

  it("returns the organization, role, email and expiry without a session", async () => {
    const org = await createOrg({ name: "Escola Alfa" });
    const inviter = await createUser({ name: "Coord Alfa" });
    await addMember(inviter.id, org.id, "coordinator");
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email: "new.teacher@test.local",
      role: "teacher",
    });

    const response = await app.inject({ method: "GET", url: `/v1/invitations/${inv.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        id: inv.id,
        email: "new.teacher@test.local",
        role: "teacher",
        status: "pending",
        expiresAt: inv.expiresAt.toISOString(),
        organizationName: "Escola Alfa",
        inviterName: "Coord Alfa",
      },
    });
  });

  it("returns 404 for an unknown invitation", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/invitations/${randomUUID()}`,
    });
    expect(response.statusCode).toBe(404);
  });

  it.each([
    { stored: "accepted", expected: "accepted" },
    { stored: "rejected", expected: "rejected" },
    { stored: "canceled", expected: "canceled" },
  ])(
    "reports a $stored invitation as $expected without the invitation details",
    async ({ stored, expected }) => {
      const org = await createOrg({ name: "Escola Terminal" });
      const inviter = await createUser();
      const inv = await insertInvitation({
        organizationId: org.id,
        inviterId: inviter.id,
        email: `${stored}@test.local`,
        status: stored,
      });

      const response = await app.inject({ method: "GET", url: `/v1/invitations/${inv.id}` });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        id: inv.id,
        status: expected,
        organizationName: "Escola Terminal",
      });
    }
  );

  it("reports a pending invitation past its expiry as expired", async () => {
    const org = await createOrg();
    const inviter = await createUser();
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email: "late@test.local",
      expiresAt: new Date(Date.now() - DAY_MS),
    });

    const response = await app.inject({ method: "GET", url: `/v1/invitations/${inv.id}` });

    expect(response.json().data).toEqual({
      id: inv.id,
      status: "expired",
      organizationName: org.name,
    });
  });

  it("reports a pending invitation of a deactivated organization as canceled", async () => {
    const org = await createOrg({ isActive: false });
    const inviter = await createUser();
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email: "inactive-org@test.local",
    });

    const response = await app.inject({ method: "GET", url: `/v1/invitations/${inv.id}` });

    expect(response.json().data).toEqual({
      id: inv.id,
      status: "canceled",
      organizationName: org.name,
    });
  });

  it("keeps other /v1/invitations paths and methods authenticated", async () => {
    const nested = await app.inject({
      method: "GET",
      url: `/v1/invitations/${randomUUID()}/anything`,
    });
    expect(nested.statusCode).toBe(401);

    const post = await app.inject({
      method: "POST",
      url: `/v1/invitations/${randomUUID()}`,
      payload: {},
    });
    expect(post.statusCode).toBe(401);
  });
});

describe("accepting an invitation end to end", () => {
  let app: App;

  beforeAll(async () => {
    app = await getApp();
  });

  it("lets a new user sign up and accept a platform-admin invitation with the invited role", async () => {
    const org = await createOrg({ name: "Escola Beta" });
    const admin = await createUser({ isPlatformAdmin: true });
    const adminCookie = await loginAs({ email: admin.email, password: TEST_PASSWORD });

    // Platform admins are not members of the org; their invitations are
    // inserted directly and must still be acceptable.
    const created = await app.inject({
      method: "POST",
      url: `/v1/organizations/${org.id}/invitations`,
      headers: { cookie: adminCookie },
      payload: { email: "Invited.Teacher@test.local", role: "teacher" },
    });
    expect(created.statusCode).toBe(201);
    const invitationId: string = created.json().data.id;

    const cookie = await signUp(app, "invited.teacher@test.local");

    const accepted = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie },
      payload: { invitationId },
    });
    expect(accepted.statusCode).toBe(200);

    const [invitedUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, "invited.teacher@test.local"));
    const memberships = await db
      .select()
      .from(member)
      .where(eq(member.userId, invitedUser!.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ organizationId: org.id, role: "teacher" });

    const [stored] = await db.select().from(invitation).where(eq(invitation.id, invitationId));
    expect(stored?.status).toBe("accepted");

    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, invitedUser!.id));
    expect(sessions.some((s) => s.activeOrganizationId === org.id)).toBe(true);

    const preview = await app.inject({ method: "GET", url: `/v1/invitations/${invitationId}` });
    expect(preview.json().data.status).toBe("accepted");
  });

  it("lets an existing user log in and accept", async () => {
    const org = await createOrg();
    const inviter = await createUser();
    await addMember(inviter.id, org.id, "coordinator");
    const invitee = await createUser({ email: "existing@test.local" });
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email: "existing@test.local",
      role: "student",
    });
    const cookie = await loginAs({ email: invitee.email, password: TEST_PASSWORD });

    const accepted = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie },
      payload: { invitationId: inv.id },
    });

    expect(accepted.statusCode).toBe(200);
    const [membership] = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, invitee.id), eq(member.organizationId, org.id)));
    expect(membership?.role).toBe("student");
  });

  it("refuses an invitation addressed to another email", async () => {
    const org = await createOrg();
    const inviter = await createUser();
    await addMember(inviter.id, org.id, "coordinator");
    const other = await createUser({ email: "someone.else@test.local" });
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email: "intended@test.local",
    });
    const cookie = await loginAs({ email: other.email, password: TEST_PASSWORD });

    const accepted = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie },
      payload: { invitationId: inv.id },
    });

    expect(accepted.statusCode).toBe(403);
    const memberships = await db.select().from(member).where(eq(member.userId, other.id));
    expect(memberships).toHaveLength(0);
  });

  it("lets the invited user decline", async () => {
    const org = await createOrg();
    const inviter = await createUser();
    await addMember(inviter.id, org.id, "coordinator");
    const invitee = await createUser({ email: "decliner@test.local" });
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email: "decliner@test.local",
    });
    const cookie = await loginAs({ email: invitee.email, password: TEST_PASSWORD });

    const rejected = await app.inject({
      method: "POST",
      url: "/api/auth/organization/reject-invitation",
      headers: { cookie },
      payload: { invitationId: inv.id },
    });

    expect(rejected.statusCode).toBe(200);
    const preview = await app.inject({ method: "GET", url: `/v1/invitations/${inv.id}` });
    expect(preview.json().data.status).toBe("rejected");
    const memberships = await db.select().from(member).where(eq(member.userId, invitee.id));
    expect(memberships).toHaveLength(0);
  });

  it("skips the email-domain auto-assignment when a pending invitation to the same org exists", async () => {
    const org = await createOrg();
    const inviter = await createUser();
    await addMember(inviter.id, org.id, "coordinator");
    await db.insert(organizationEmailDomain).values({
      id: randomUUID(),
      organizationId: org.id,
      domain: "escola.test",
      role: "student",
    });
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email: "prof@escola.test",
      role: "teacher",
    });

    const cookie = await signUp(app, "prof@escola.test");
    const [created] = await db.select().from(user).where(eq(user.email, "prof@escola.test"));
    expect(await db.select().from(member).where(eq(member.userId, created!.id))).toHaveLength(0);

    const accepted = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie },
      payload: { invitationId: inv.id },
    });

    expect(accepted.statusCode).toBe(200);
    const memberships = await db.select().from(member).where(eq(member.userId, created!.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("teacher");
  });

  /** Org with a coordinator, a `student` domain rule and a pending `teacher` invite. */
  async function orgWithDomainRuleAndInvitation(domain: string, email: string) {
    const org = await createOrg();
    const inviter = await createUser();
    await addMember(inviter.id, org.id, "coordinator");
    await db.insert(organizationEmailDomain).values({
      id: randomUUID(),
      organizationId: org.id,
      domain,
      role: "student",
    });
    const inv = await insertInvitation({
      organizationId: org.id,
      inviterId: inviter.id,
      email,
      role: "teacher",
    });
    return { org, inv };
  }

  it("applies the email-domain rule when the invited user declines", async () => {
    const { org, inv } = await orgWithDomainRuleAndInvitation(
      "decline-domain.test",
      "prof@decline-domain.test"
    );
    const cookie = await signUp(app, "prof@decline-domain.test");

    const rejected = await app.inject({
      method: "POST",
      url: "/api/auth/organization/reject-invitation",
      headers: { cookie },
      payload: { invitationId: inv.id },
    });

    expect(rejected.statusCode).toBe(200);
    const [created] = await db
      .select()
      .from(user)
      .where(eq(user.email, "prof@decline-domain.test"));
    const memberships = await db.select().from(member).where(eq(member.userId, created!.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ organizationId: org.id, role: "student" });
  });

  it("applies the email-domain rule when the invitation expired before it was accepted", async () => {
    const { org, inv } = await orgWithDomainRuleAndInvitation(
      "expired-domain.test",
      "prof@expired-domain.test"
    );
    const cookie = await signUp(app, "prof@expired-domain.test");
    await db
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() - DAY_MS) })
      .where(eq(invitation.id, inv.id));

    const accepted = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie },
      payload: { invitationId: inv.id },
    });

    expect(accepted.statusCode).toBe(400);
    const [created] = await db
      .select()
      .from(user)
      .where(eq(user.email, "prof@expired-domain.test"));
    const memberships = await db.select().from(member).where(eq(member.userId, created!.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ organizationId: org.id, role: "student" });
  });

  it("does not add a domain membership when a user who already belongs elsewhere declines", async () => {
    const { org, inv } = await orgWithDomainRuleAndInvitation(
      "member-elsewhere.test",
      "prof@member-elsewhere.test"
    );
    const invitee = await createUser({ email: "prof@member-elsewhere.test" });
    const otherOrg = await createOrg();
    await addMember(invitee.id, otherOrg.id, "teacher");
    const cookie = await loginAs({ email: invitee.email, password: TEST_PASSWORD });

    const rejected = await app.inject({
      method: "POST",
      url: "/api/auth/organization/reject-invitation",
      headers: { cookie },
      payload: { invitationId: inv.id },
    });

    expect(rejected.statusCode).toBe(200);
    const memberships = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, invitee.id), eq(member.organizationId, org.id)));
    expect(memberships).toHaveLength(0);
  });

  it("still auto-assigns by email domain when there is no pending invitation", async () => {
    const org = await createOrg();
    await db.insert(organizationEmailDomain).values({
      id: randomUUID(),
      organizationId: org.id,
      domain: "domain-only.test",
      role: "student",
    });

    await signUp(app, "aluno@domain-only.test");

    const [created] = await db.select().from(user).where(eq(user.email, "aluno@domain-only.test"));
    const memberships = await db.select().from(member).where(eq(member.userId, created!.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ organizationId: org.id, role: "student" });
  });
});
