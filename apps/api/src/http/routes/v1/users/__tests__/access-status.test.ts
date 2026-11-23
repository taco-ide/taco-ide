import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@repo/infra/db";
import { invitation } from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createOrg,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

const URL = "/v1/users/me/access-status";
const DAY = 24 * 60 * 60 * 1000;

async function invite(opts: {
  email: string;
  organizationId: string;
  inviterId: string;
  role?: string;
  status?: string;
  expiresAt?: Date;
}) {
  const [row] = await db
    .insert(invitation)
    .values({
      id: randomUUID(),
      email: opts.email,
      organizationId: opts.organizationId,
      inviterId: opts.inviterId,
      role: opts.role ?? "student",
      status: opts.status ?? "pending",
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 7 * DAY),
    })
    .returning();
  return row!;
}

describe("GET /v1/users/me/access-status", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  async function getStatus(cookie?: string) {
    return app.inject({
      method: "GET",
      url: URL,
      headers: cookie ? { cookie } : {},
    });
  }

  it("requires a session", async () => {
    const response = await getStatus();
    expect(response.statusCode).toBe(401);
  });

  it("reports a brand-new user with no memberships and no invitations", async () => {
    const newcomer = await createUser();
    const cookie = await loginAs({ email: newcomer.email, password: TEST_PASSWORD });

    const response = await getStatus(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      hasActiveMembership: false,
      hasInactiveOrganizationMembership: false,
      pendingInvitations: [],
    });
  });

  it("flags users whose only organization was deactivated", async () => {
    const org = await createOrg({ isActive: false });
    const removed = await createUser();
    await addMember(removed.id, org.id, "teacher");
    const cookie = await loginAs({ email: removed.email, password: TEST_PASSWORD });

    const response = await getStatus(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      hasActiveMembership: false,
      hasInactiveOrganizationMembership: true,
    });
  });

  it("reports an active membership once the user has been added", async () => {
    const org = await createOrg();
    const added = await createUser();
    await addMember(added.id, org.id, "student");
    const cookie = await loginAs({ email: added.email, password: TEST_PASSWORD });

    const response = await getStatus(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      hasActiveMembership: true,
      hasInactiveOrganizationMembership: false,
    });
  });

  it("lists only usable invitations addressed to the user's email", async () => {
    const org = await createOrg({ name: "Escola Alfa" });
    const otherOrg = await createOrg({ name: "Escola Beta" });
    const inactiveOrg = await createOrg({ name: "Escola Inativa", isActive: false });
    const inviter = await createUser({ name: "Coord Ana" });
    const invitee = await createUser({ email: "new.student@school.test" });

    const usable = await invite({
      // Invitations are matched case-insensitively.
      email: "New.Student@School.test",
      organizationId: org.id,
      inviterId: inviter.id,
      role: "teacher",
    });
    const second = await invite({
      email: invitee.email,
      organizationId: otherOrg.id,
      inviterId: inviter.id,
    });
    await invite({ email: invitee.email, organizationId: org.id, inviterId: inviter.id, status: "canceled" });
    await invite({ email: invitee.email, organizationId: org.id, inviterId: inviter.id, status: "accepted" });
    await invite({
      email: invitee.email,
      organizationId: org.id,
      inviterId: inviter.id,
      expiresAt: new Date(Date.now() - DAY),
    });
    await invite({ email: invitee.email, organizationId: inactiveOrg.id, inviterId: inviter.id });
    await invite({ email: "someone.else@school.test", organizationId: org.id, inviterId: inviter.id });

    const cookie = await loginAs({ email: invitee.email, password: TEST_PASSWORD });
    const response = await getStatus(cookie);

    expect(response.statusCode).toBe(200);
    const { pendingInvitations } = response.json().data;
    expect(pendingInvitations).toHaveLength(2);
    expect(pendingInvitations).toEqual(
      expect.arrayContaining([
        {
          id: usable.id,
          organizationName: "Escola Alfa",
          role: "teacher",
          inviterName: "Coord Ana",
          expiresAt: usable.expiresAt.toISOString(),
        },
        expect.objectContaining({ id: second.id, organizationName: "Escola Beta", role: "student" }),
      ])
    );
  });

  it("does not reveal invitations to an unverified email address", async () => {
    const org = await createOrg();
    const inviter = await createUser();
    const unverified = await createUser({ emailVerified: false });
    await invite({ email: unverified.email, organizationId: org.id, inviterId: inviter.id });
    const cookie = await loginAs({ email: unverified.email, password: TEST_PASSWORD });

    const response = await getStatus(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.pendingInvitations).toEqual([]);
  });
});
