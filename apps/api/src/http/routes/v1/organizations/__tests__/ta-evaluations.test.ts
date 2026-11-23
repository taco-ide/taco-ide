/**
 * Issue #99 — anonymous teaching-assistant rating statistics.
 *
 * Covers the organization-scoped aggregate endpoint and its CSV export:
 * authorization (students, non-members, other organizations, inactive
 * organizations), aggregate correctness (count, mean, 1–5 distribution,
 * zero-filled weekly series, TA and date filters), small-cell suppression
 * (k = TA_RATING_MIN_GROUP_SIZE, pinned to 5 by the test global setup) and
 * CSV encoding (BOM, quoting, formula neutralisation).
 */
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { env } from "@repo/infra/env";
import {
  organization,
  teachingAssistant,
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

const K = 5;

type Summary = { count: number | null; mean: number | null; suppressed: boolean };
type StatsBody = {
  success: true;
  data: {
    minGroupSize: number;
    total: number | null;
    mean: number | null;
    suppressed: boolean;
    distribution: { grade: number; count: number }[] | null;
    weekly: ({ week: string } & Summary)[];
    teachingAssistants: ({
      id: string;
      alias: string;
      version: number;
      isActive: boolean;
    } & Summary)[];
  };
};

const BOM = "﻿";
const CSV_HEADER =
  "week,teaching_assistant_id,teaching_assistant_alias,teaching_assistant_version,count,mean,grade_1,grade_2,grade_3,grade_4,grade_5,suppressed";

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

function csvLines(body: string): string[] {
  expect(body.startsWith(BOM)).toBe(true);
  return body.slice(BOM.length).trimEnd().split("\n");
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

  const get = (url: string, cookie?: string) =>
    app.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });

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
    // Groups (week × TA): A/03-02 has k ratings, A/03-09 has k-1 (withheld),
    // B/03-09 has k, B/03-23 has k+1; week 03-16 has none.
    await rate(taA.id, "2026-03-02", [5, 5, 4, 4, 3]);
    await rate(taA.id, "2026-03-09", [1, 2, 2, 3]);
    await rate(taB.id, "2026-03-09", [3, 3, 4, 4, 5]);
    await rate(taB.id, "2026-03-23", [2, 2, 3, 3, 4, 4]);
    await rate(otherTa.id, "2026-03-09", [1, 1, 1, 1, 1]);

    cookies = Object.fromEntries(
      await Promise.all(
        Object.entries(users).map(async ([key, u]) => [
          key,
          await loginAs({ email: u.email, password: TEST_PASSWORD }),
        ])
      )
    ) as typeof cookies;
  });

  it("runs with the pinned suppression threshold", () => {
    expect(env.TA_RATING_MIN_GROUP_SIZE).toBe(K);
  });

  // ===== authorization =====

  it("requires authentication", async () => {
    for (const url of [statsUrl(org.id), exportUrl(org.id)]) {
      expect((await get(url)).statusCode).toBe(401);
    }
  });

  it("forbids students of the organization", async () => {
    for (const url of [statsUrl(org.id), exportUrl(org.id)]) {
      expect((await get(url, cookies.student)).statusCode).toBe(403);
    }
  });

  it("forbids staff of another organization", async () => {
    for (const url of [statsUrl(org.id), exportUrl(org.id)]) {
      expect((await get(url, cookies.otherCoordinator)).statusCode).toBe(403);
    }
  });

  it("does not reveal whether an organization exists to non-members", async () => {
    for (const orgId of [randomUUID(), org.id]) {
      for (const url of [statsUrl(orgId), exportUrl(orgId)]) {
        expect((await get(url, cookies.otherCoordinator)).statusCode).toBe(403);
      }
    }
  });

  it("forbids staff once the organization is deactivated", async () => {
    await db
      .update(organization)
      .set({ isActive: false })
      .where(eq(organization.id, org.id));
    for (const url of [statsUrl(org.id), exportUrl(org.id)]) {
      expect((await get(url, cookies.coordinator)).statusCode).toBe(403);
    }
  });

  it("returns 404 for an unknown organization to platform admins", async () => {
    for (const url of [statsUrl(randomUUID()), exportUrl(randomUUID())]) {
      expect((await get(url, cookies.platformAdmin)).statusCode).toBe(404);
    }
  });

  it("allows teachers, coordinators, admins and platform admins", async () => {
    for (const key of ["teacher", "coordinator", "admin", "platformAdmin"] as const) {
      expect((await get(statsUrl(org.id), cookies[key])).statusCode, key).toBe(200);
      expect((await get(exportUrl(org.id), cookies[key])).statusCode, key).toBe(200);
    }
  });

  it("refuses a teaching assistant from another organization", async () => {
    const qs = `?teachingAssistantId=${otherTa.id}`;
    for (const url of [statsUrl(org.id, qs), exportUrl(org.id, qs)]) {
      expect((await get(url, cookies.coordinator)).statusCode).toBe(404);
    }
  });

  it("rejects an inverted date range", async () => {
    const qs = "?from=2026-04-01&to=2026-03-01";
    for (const url of [statsUrl(org.id, qs), exportUrl(org.id, qs)]) {
      expect((await get(url, cookies.coordinator)).statusCode).toBe(400);
    }
  });

  // ===== aggregates =====

  it("aggregates the organization's groups of at least k ratings", async () => {
    const res = await get(statsUrl(org.id, "?to=2026-03-29"), cookies.teacher);
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as StatsBody;

    expect(data.minGroupSize).toBe(K);
    // Visible: A/03-02 (5,5,4,4,3), B/03-09 (3,3,4,4,5), B/03-23 (2,2,3,3,4,4)
    // → 16 ratings, sum 58. A/03-09 (k-1 ratings) is withheld.
    expect(data.total).toBe(16);
    expect(data.mean).toBe(3.63);
    expect(data.suppressed).toBe(true);
    expect(data.distribution).toEqual([
      { grade: 1, count: 0 },
      { grade: 2, count: 2 },
      { grade: 3, count: 5 },
      { grade: 4, count: 6 },
      { grade: 5, count: 3 },
    ]);

    // Zero-filled: 03-16 has no ratings; 03-09 only shows the visible group.
    expect(data.weekly).toEqual([
      { week: "2026-03-02", count: 5, mean: 4.2, suppressed: false },
      { week: "2026-03-09", count: 5, mean: 3.8, suppressed: true },
      { week: "2026-03-16", count: 0, mean: null, suppressed: false },
      { week: "2026-03-23", count: 6, mean: 3, suppressed: false },
    ]);

    const byId = new Map(data.teachingAssistants.map((t) => [t.id, t]));
    expect(byId.size).toBe(2);
    expect(byId.get(taA.id)).toMatchObject({ count: 5, mean: 4.2, suppressed: true });
    expect(byId.get(taB.id)).toMatchObject({ count: 11, mean: 3.36, suppressed: false });
    expect(byId.has(otherTa.id)).toBe(false);

    // No identifying fields leak out.
    expect(JSON.stringify(data)).not.toMatch(/userId|workSession|email/i);
  });

  it("withholds a group of k-1 ratings and shows it once it reaches k", async () => {
    const qs = `?teachingAssistantId=${taA.id}&from=2026-03-10&to=2026-03-15`;

    const before = (await get(statsUrl(org.id, qs), cookies.coordinator)).json() as StatsBody;
    expect(before.data).toMatchObject({
      total: null,
      mean: null,
      distribution: null,
      suppressed: true,
    });
    expect(before.data.weekly).toEqual([
      { week: "2026-03-09", count: null, mean: null, suppressed: true },
    ]);
    const aBefore = before.data.teachingAssistants.find((t) => t.id === taA.id);
    expect(aBefore).toMatchObject({ count: null, mean: null, suppressed: true });

    await rate(taA.id, "2026-03-09", [2]);

    const after = (await get(statsUrl(org.id, qs), cookies.coordinator)).json() as StatsBody;
    expect(after.data).toMatchObject({ total: K, mean: 2, suppressed: false });
    expect(after.data.distribution?.map((d) => d.count)).toEqual([1, 3, 1, 0, 0]);
    expect(after.data.weekly).toEqual([
      { week: "2026-03-09", count: K, mean: 2, suppressed: false },
    ]);
    const aAfter = after.data.teachingAssistants.find((t) => t.id === taA.id);
    expect(aAfter).toMatchObject({ count: K, mean: 2, suppressed: false });
  });

  it("filters by teaching assistant and date range", async () => {
    const res = await get(
      statsUrl(org.id, `?teachingAssistantId=${taB.id}&from=2026-03-10&to=2026-03-31`),
      cookies.coordinator
    );
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as StatsBody;

    // `from` falls mid-week: the week starting 2026-03-09 is included.
    expect(data.total).toBe(11);
    expect(data.mean).toBe(3.36);
    expect(data.suppressed).toBe(false);
    expect(data.weekly.map((w) => [w.week, w.count])).toEqual([
      ["2026-03-09", 5],
      ["2026-03-16", 0],
      ["2026-03-23", 6],
      ["2026-03-30", 0],
    ]);

    // Per-TA rows ignore the TA filter but honour the date range.
    const byId = new Map(data.teachingAssistants.map((t) => [t.id, t]));
    expect(byId.get(taA.id)).toMatchObject({ count: null, mean: null, suppressed: true });
    expect(byId.get(taB.id)).toMatchObject({ count: 11, mean: 3.36, suppressed: false });
  });

  it("returns an empty aggregate when there are no ratings", async () => {
    const res = await get(statsUrl(org.id, "?from=2027-01-01"), cookies.coordinator);
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as StatsBody;
    expect(data.total).toBe(0);
    expect(data.mean).toBeNull();
    expect(data.suppressed).toBe(false);
    expect(data.distribution?.map((d) => d.count)).toEqual([0, 0, 0, 0, 0]);
    expect(data.weekly).toEqual([]);
    expect(
      data.teachingAssistants.every(
        (t) => t.count === 0 && t.mean === null && !t.suppressed
      )
    ).toBe(true);
  });

  // ===== CSV export =====

  it("exports aggregated week × TA rows with a BOM and suppression", async () => {
    const res = await get(exportUrl(org.id), cookies.coordinator);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename=".+\.csv"/);

    const lines = csvLines(res.body);
    expect(lines[0]).toBe(CSV_HEADER);
    const [first, second] = [taA, taB].sort((x, y) => x.alias.localeCompare(y.alias));
    const row: Record<string, string> = {
      [`2026-03-02:${taA.id}`]: `2026-03-02,${taA.id},${taA.alias},1,5,4.2,0,0,1,2,2,false`,
      [`2026-03-09:${taA.id}`]: `2026-03-09,${taA.id},${taA.alias},1,,,,,,,,true`,
      [`2026-03-09:${taB.id}`]: `2026-03-09,${taB.id},${taB.alias},1,5,3.8,0,0,2,2,1,false`,
      [`2026-03-23:${taB.id}`]: `2026-03-23,${taB.id},${taB.alias},1,6,3,0,2,2,2,0,false`,
    };
    expect(lines.slice(1)).toEqual([
      row[`2026-03-02:${taA.id}`],
      row[`2026-03-09:${first!.id}`],
      row[`2026-03-09:${second!.id}`],
      row[`2026-03-23:${taB.id}`],
    ]);
    // Never one row per rating, and never another organization's data.
    expect(res.body).not.toContain(otherTa.id);
  });

  it("filters the export by teaching assistant and date range", async () => {
    const res = await get(
      exportUrl(org.id, `?teachingAssistantId=${taA.id}&from=2026-03-09`),
      cookies.admin
    );
    expect(res.statusCode).toBe(200);
    expect(csvLines(res.body).slice(1)).toEqual([
      `2026-03-09,${taA.id},${taA.alias},1,,,,,,,,true`,
    ]);
  });

  it("quotes and neutralises user-provided aliases in the CSV", async () => {
    const aliases = ['=HYPERLINK("http://x")', 'say "hi"', "a,b", "line\nbreak", "+1", "@cmd"];
    for (const alias of aliases) {
      const ta = await createTeachingAssistant({ organizationId: org.id });
      await db
        .update(teachingAssistant)
        .set({ alias })
        .where(eq(teachingAssistant.id, ta.id));
      // A single (withheld) rating still emits the TA's row and alias.
      await rate(ta.id, "2026-04-06", [3]);
    }

    const res = await get(exportUrl(org.id, "?from=2026-04-01"), cookies.coordinator);
    expect(res.statusCode).toBe(200);
    const body = res.body;
    expect(body).toContain(`,"'=HYPERLINK(""http://x"")",`);
    expect(body).toContain(`,"say ""hi""",`);
    expect(body).toContain(`,"a,b",`);
    expect(body).toContain(`,"line\nbreak",`);
    expect(body).toContain(`,'+1,`);
    expect(body).toContain(`,'@cmd,`);
    // No cell starts with a raw formula trigger.
    expect(body).not.toMatch(/(^|,)[=+@]/m);
  });
});
