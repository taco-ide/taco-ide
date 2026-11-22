/**
 * Issue #99 — anonymous teaching-assistant rating statistics.
 *
 * Covers the organization-scoped aggregate endpoint and its CSV export:
 * authorization (students, other organizations, inactive organizations)
 * and aggregate correctness (count, mean, 1–5 distribution, weekly series,
 * TA and date filters).
 */
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  organization,
  teachingAssistantEvaluation,
} from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createOrg,
  createTeachingAssistant,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

type StatsBody = {
  success: true;
  data: {
    total: number;
    mean: number | null;
    distribution: { grade: number; count: number }[];
    weekly: { week: string; count: number; mean: number }[];
    teachingAssistants: {
      id: string;
      alias: string;
      version: number;
      isActive: boolean;
      count: number;
      mean: number | null;
    }[];
  };
};

async function rate(teachingAssistantId: string, week: string, grades: number[]) {
  if (grades.length === 0) return;
  await db.insert(teachingAssistantEvaluation).values(
    grades.map((grade) => ({
      id: randomUUID(),
      teachingAssistantId,
      grade,
      week: new Date(`${week}T00:00:00Z`),
    }))
  );
}

describe("teaching assistant evaluation stats", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let org: Awaited<ReturnType<typeof createOrg>>;
  let otherOrg: Awaited<ReturnType<typeof createOrg>>;
  let taA: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let taB: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let otherTa: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let cookies: Record<
    "teacher" | "coordinator" | "admin" | "student" | "otherCoordinator" | "platformAdmin",
    string
  >;

  const statsUrl = (orgId: string, qs = "") =>
    `/v1/organizations/${orgId}/teaching-assistant-evaluations/stats${qs}`;
  const exportUrl = (orgId: string, qs = "") =>
    `/v1/organizations/${orgId}/teaching-assistant-evaluations/export${qs}`;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    org = await createOrg();
    otherOrg = await createOrg();

    const users = {
      teacher: await createUser(),
      coordinator: await createUser(),
      admin: await createUser(),
      student: await createUser(),
      otherCoordinator: await createUser(),
      platformAdmin: await createUser({ isPlatformAdmin: true }),
    };
    await addMember(users.teacher.id, org.id, "teacher");
    await addMember(users.coordinator.id, org.id, "coordinator");
    await addMember(users.admin.id, org.id, "admin");
    await addMember(users.student.id, org.id, "student");
    await addMember(users.otherCoordinator.id, otherOrg.id, "coordinator");

    taA = await createTeachingAssistant({ organizationId: org.id });
    taB = await createTeachingAssistant({ organizationId: org.id });
    otherTa = await createTeachingAssistant({ organizationId: otherOrg.id });

    // Weeks are Mondays (ISO week start, as written by date_trunc('week')).
    await rate(taA.id, "2026-03-02", [5, 4, 4]);
    await rate(taA.id, "2026-03-09", [1, 2]);
    await rate(taB.id, "2026-03-09", [3]);
    await rate(otherTa.id, "2026-03-09", [1, 1, 1, 1]);

    cookies = Object.fromEntries(
      await Promise.all(
        Object.entries(users).map(async ([key, u]) => [
          key,
          await loginAs({ email: u.email, password: TEST_PASSWORD }),
        ])
      )
    ) as typeof cookies;
  });

  // ===== authorization =====

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: statsUrl(org.id) });
    expect(res.statusCode).toBe(401);
  });

  it("forbids students of the organization", async () => {
    for (const url of [statsUrl(org.id), exportUrl(org.id)]) {
      const res = await app.inject({
        method: "GET",
        url,
        headers: { cookie: cookies.student },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it("forbids staff of another organization", async () => {
    for (const url of [statsUrl(org.id), exportUrl(org.id)]) {
      const res = await app.inject({
        method: "GET",
        url,
        headers: { cookie: cookies.otherCoordinator },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it("forbids staff once the organization is deactivated", async () => {
    await db
      .update(organization)
      .set({ isActive: false })
      .where(eq(organization.id, org.id));
    const res = await app.inject({
      method: "GET",
      url: statsUrl(org.id),
      headers: { cookie: cookies.coordinator },
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  it("returns 404 for an unknown organization", async () => {
    const res = await app.inject({
      method: "GET",
      url: statsUrl(randomUUID()),
      headers: { cookie: cookies.platformAdmin },
    });
    expect(res.statusCode).toBe(404);
  });

  it("allows teachers, coordinators, admins and platform admins", async () => {
    for (const key of ["teacher", "coordinator", "admin", "platformAdmin"] as const) {
      const res = await app.inject({
        method: "GET",
        url: statsUrl(org.id),
        headers: { cookie: cookies[key] },
      });
      expect(res.statusCode, key).toBe(200);
    }
  });

  it("refuses a teaching assistant from another organization", async () => {
    const res = await app.inject({
      method: "GET",
      url: statsUrl(org.id, `?teachingAssistantId=${otherTa.id}`),
      headers: { cookie: cookies.coordinator },
    });
    expect(res.statusCode).toBe(404);
  });

  // ===== aggregates =====

  it("aggregates only the organization's teaching assistants", async () => {
    const res = await app.inject({
      method: "GET",
      url: statsUrl(org.id),
      headers: { cookie: cookies.teacher },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as StatsBody;

    // taA: 5,4,4,1,2  taB: 3  → 6 ratings, sum 19
    expect(data.total).toBe(6);
    expect(data.mean).toBeCloseTo(19 / 6, 2);
    expect(data.distribution).toEqual([
      { grade: 1, count: 1 },
      { grade: 2, count: 1 },
      { grade: 3, count: 1 },
      { grade: 4, count: 2 },
      { grade: 5, count: 1 },
    ]);
    expect(data.weekly).toEqual([
      { week: "2026-03-02", count: 3, mean: 4.33 },
      { week: "2026-03-09", count: 3, mean: 2 },
    ]);

    const byId = new Map(data.teachingAssistants.map((t) => [t.id, t]));
    expect(byId.size).toBe(2);
    expect(byId.get(taA.id)).toMatchObject({ count: 5, mean: 3.2 });
    expect(byId.get(taB.id)).toMatchObject({ count: 1, mean: 3 });
    expect(byId.has(otherTa.id)).toBe(false);

    // No identifying fields leak out.
    expect(JSON.stringify(data)).not.toMatch(/userId|workSession|email/i);
  });

  it("filters by teaching assistant and date range", async () => {
    const res = await app.inject({
      method: "GET",
      url: statsUrl(
        org.id,
        `?teachingAssistantId=${taA.id}&from=2026-03-10&to=2026-03-31`
      ),
      headers: { cookie: cookies.coordinator },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as StatsBody;

    // `from` falls mid-week: the week starting 2026-03-09 is included.
    expect(data.total).toBe(2);
    expect(data.mean).toBe(1.5);
    expect(data.distribution.map((d) => d.count)).toEqual([1, 1, 0, 0, 0]);
    expect(data.weekly).toEqual([{ week: "2026-03-09", count: 2, mean: 1.5 }]);

    // Per-TA rows ignore the TA filter but honour the date range.
    const byId = new Map(data.teachingAssistants.map((t) => [t.id, t]));
    expect(byId.get(taA.id)).toMatchObject({ count: 2, mean: 1.5 });
    expect(byId.get(taB.id)).toMatchObject({ count: 1, mean: 3 });
  });

  it("returns an empty aggregate when there are no ratings", async () => {
    const res = await app.inject({
      method: "GET",
      url: statsUrl(org.id, "?from=2027-01-01"),
      headers: { cookie: cookies.coordinator },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as StatsBody;
    expect(data.total).toBe(0);
    expect(data.mean).toBeNull();
    expect(data.distribution.map((d) => d.count)).toEqual([0, 0, 0, 0, 0]);
    expect(data.weekly).toEqual([]);
    expect(data.teachingAssistants.every((t) => t.count === 0 && t.mean === null)).toBe(
      true
    );
  });

  it("rejects an inverted date range", async () => {
    const res = await app.inject({
      method: "GET",
      url: statsUrl(org.id, "?from=2026-04-01&to=2026-03-01"),
      headers: { cookie: cookies.coordinator },
    });
    expect(res.statusCode).toBe(400);
  });

  // ===== CSV export =====

  it("exports anonymous rows as CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: exportUrl(org.id, `?teachingAssistantId=${taA.id}`),
      headers: { cookie: cookies.coordinator },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename=".+\.csv"/);

    const lines = res.body.trim().split("\n");
    expect(lines[0]).toBe(
      "week,teaching_assistant_id,teaching_assistant_alias,teaching_assistant_version,grade"
    );
    expect(lines.slice(1)).toEqual([
      `2026-03-02,${taA.id},${taA.alias},1,4`,
      `2026-03-02,${taA.id},${taA.alias},1,4`,
      `2026-03-02,${taA.id},${taA.alias},1,5`,
      `2026-03-09,${taA.id},${taA.alias},1,1`,
      `2026-03-09,${taA.id},${taA.alias},1,2`,
    ]);
  });

  it("exports only the organization's ratings", async () => {
    const res = await app.inject({
      method: "GET",
      url: exportUrl(org.id),
      headers: { cookie: cookies.admin },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.body.trim().split("\n").slice(1);
    expect(rows).toHaveLength(6);
    expect(res.body).not.toContain(otherTa.id);
  });
});
