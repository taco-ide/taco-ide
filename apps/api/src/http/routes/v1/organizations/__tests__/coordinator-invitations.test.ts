/**
 * Coordinator-facing invitation flow (#69).
 *
 * The web app exposes an org-scoped "Team" screen to coordinators+ that
 * reuses the existing invitation endpoints. These tests pin the contract that
 * screen relies on: coordinators of the active organization can create, list,
 * resend and cancel invitations (but not invite admins), while teachers and
 * coordinators of other organizations cannot.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
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

const mocks = vi.hoisted(() => ({
  sendInvitationEmail: vi.fn(async () => {}),
}));
vi.mock("@repo/infra/auth/invitation-email", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@repo/infra/auth/invitation-email")
  >()),
  sendInvitationEmail: mocks.sendInvitationEmail,
}));

type InvitationList = {
  data: { id: string; email: string; role: string; status: string }[];
  pagination: { total: number };
};

describe("coordinator invitation management", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let orgId: string;
  let otherOrgId: string;
  let coordinatorCookie: string;
  let teacherCookie: string;
  let outsiderCoordinatorCookie: string;

  beforeEach(async () => {
    app = await getApp();
    mocks.sendInvitationEmail.mockClear();

    const org = await createOrg();
    const other = await createOrg();
    orgId = org.id;
    otherOrgId = other.id;

    const coordinator = await createUser();
    const teacher = await createUser();
    const outsider = await createUser();
    await addMember(coordinator.id, org.id, "coordinator");
    await addMember(teacher.id, org.id, "teacher");
    await addMember(outsider.id, other.id, "coordinator");

    coordinatorCookie = await loginAs({
      email: coordinator.email,
      password: TEST_PASSWORD,
    });
    teacherCookie = await loginAs({
      email: teacher.email,
      password: TEST_PASSWORD,
    });
    outsiderCoordinatorCookie = await loginAs({
      email: outsider.email,
      password: TEST_PASSWORD,
    });
  });

  async function invite(cookie: string, email: string, role: string) {
    return app.inject({
      method: "POST",
      url: `/v1/organizations/${orgId}/invitations`,
      headers: { cookie },
      payload: { email, role },
    });
  }

  it("lets a coordinator invite teachers and students, then list, resend and cancel them", async () => {
    const teacherInvite = await invite(
      coordinatorCookie,
      "new-teacher@school.test",
      "teacher"
    );
    expect(teacherInvite.statusCode).toBe(201);
    const studentInvite = await invite(
      coordinatorCookie,
      "new-student@school.test",
      "student"
    );
    expect(studentInvite.statusCode).toBe(201);
    expect(mocks.sendInvitationEmail).toHaveBeenCalledTimes(2);

    // Same 7-day window as the platform-admin path and the resend route.
    const expiresAt = new Date(
      (teacherInvite.json() as { data: { expiresAt: string } }).data.expiresAt
    ).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAt - (Date.now() + sevenDays))).toBeLessThan(
      60 * 60 * 1000
    );

    const list = await app.inject({
      method: "GET",
      url: `/v1/organizations/${orgId}/invitations`,
      headers: { cookie: coordinatorCookie },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as InvitationList;
    expect(body.pagination.total).toBe(2);
    expect(body.data.map((row) => [row.email, row.role]).sort()).toEqual([
      ["new-student@school.test", "student"],
      ["new-teacher@school.test", "teacher"],
    ]);

    const studentId = (studentInvite.json() as { data: { id: string } }).data
      .id;

    const resend = await app.inject({
      method: "POST",
      url: `/v1/organizations/${orgId}/invitations/${studentId}/resend`,
      headers: { cookie: coordinatorCookie },
    });
    expect(resend.statusCode).toBe(200);
    expect(mocks.sendInvitationEmail).toHaveBeenCalledTimes(3);

    const cancel = await app.inject({
      method: "DELETE",
      url: `/v1/organizations/${orgId}/invitations/${studentId}`,
      headers: { cookie: coordinatorCookie },
    });
    expect(cancel.statusCode).toBe(200);
    const [row] = await db
      .select({ status: invitation.status })
      .from(invitation)
      .where(
        and(eq(invitation.id, studentId), eq(invitation.organizationId, orgId))
      );
    expect(row?.status).toBe("canceled");
  });

  it("rejects a coordinator inviting an admin", async () => {
    // The UI caps the role picker, but the API must refuse too: Better Auth
    // only lets members holding the creator role (`admin`) invite admins.
    const res = await invite(coordinatorCookie, "boss@school.test", "admin");
    expect(res.statusCode).toBe(403);
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();

    const rows = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.email, "boss@school.test")
        )
      );
    expect(rows).toHaveLength(0);
  });

  it("rejects teachers on every invitation endpoint", async () => {
    const created = await invite(teacherCookie, "x@school.test", "student");
    expect(created.statusCode).toBe(403);

    const list = await app.inject({
      method: "GET",
      url: `/v1/organizations/${orgId}/invitations`,
      headers: { cookie: teacherCookie },
    });
    expect(list.statusCode).toBe(403);

    // Resend and cancel need a real invitation to target.
    const existing = await invite(
      coordinatorCookie,
      "pending@school.test",
      "student"
    );
    expect(existing.statusCode).toBe(201);
    const invitationId = (existing.json() as { data: { id: string } }).data.id;
    mocks.sendInvitationEmail.mockClear();

    const resend = await app.inject({
      method: "POST",
      url: `/v1/organizations/${orgId}/invitations/${invitationId}/resend`,
      headers: { cookie: teacherCookie },
    });
    expect(resend.statusCode).toBe(403);
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();

    const cancel = await app.inject({
      method: "DELETE",
      url: `/v1/organizations/${orgId}/invitations/${invitationId}`,
      headers: { cookie: teacherCookie },
    });
    expect(cancel.statusCode).toBe(403);

    const [row] = await db
      .select({ status: invitation.status })
      .from(invitation)
      .where(eq(invitation.id, invitationId));
    expect(row?.status).toBe("pending");
  });

  it("rejects coordinators of another organization", async () => {
    const created = await invite(
      outsiderCoordinatorCookie,
      "y@school.test",
      "student"
    );
    expect(created.statusCode).toBe(403);

    const list = await app.inject({
      method: "GET",
      url: `/v1/organizations/${orgId}/invitations`,
      headers: { cookie: outsiderCoordinatorCookie },
    });
    expect(list.statusCode).toBe(403);

    // Sanity: the outsider still manages their own organization.
    const own = await app.inject({
      method: "GET",
      url: `/v1/organizations/${otherOrgId}/invitations`,
      headers: { cookie: outsiderCoordinatorCookie },
    });
    expect(own.statusCode).toBe(200);
  });
});
