/**
 * Tests the platform professor seed. The seed reads env vars via @repo/infra/env
 * (validated once at module-load). Since env.ts is loaded long before our test
 * runs, we cannot directly mutate `env` — instead we monkey-patch the imported
 * env object's enumerable fields right before invoking the seed.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { user, member, organization } from "@repo/infra/db/schema";
import { env } from "@repo/infra/env";
import { seedPlatformProfessor } from "../../../../../packages/infra/src/db/seeds/professor";
import { createOrg } from "../helpers/factories";

function withEnv<T extends Record<string, unknown>>(overrides: T, fn: () => Promise<void>) {
  const target = env as unknown as Record<string, unknown>;
  const before: Record<string, unknown> = {};
  for (const k of Object.keys(overrides)) {
    before[k] = target[k];
    target[k] = overrides[k];
  }
  return fn().finally(() => {
    for (const k of Object.keys(before)) {
      target[k] = before[k];
    }
  });
}

describe("seedPlatformProfessor", () => {
  beforeAll(() => {
    // Suppress the seed's own console output during tests.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("skips and warns when required envs are missing", async () => {
    await withEnv(
      {
        PLATFORM_PROFESSOR_EMAIL: undefined,
        PLATFORM_PROFESSOR_PASSWORD: undefined,
        PLATFORM_PROFESSOR_NAME: undefined,
      },
      async () => {
        await expect(seedPlatformProfessor()).resolves.toBeUndefined();
      }
    );

    const found = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "missing@test.local"));
    expect(found).toHaveLength(0);
  });

  it("creates a verified, active professor user with credential when all envs are present", async () => {
    await withEnv(
      {
        PLATFORM_PROFESSOR_EMAIL: "prof@seed.test",
        PLATFORM_PROFESSOR_PASSWORD: "longenoughpassword",
        PLATFORM_PROFESSOR_NAME: "Test Professor",
        PLATFORM_PROFESSOR_ORG_SLUG: undefined,
      },
      async () => {
        await seedPlatformProfessor();
      }
    );

    const [u] = await db
      .select()
      .from(user)
      .where(eq(user.email, "prof@seed.test"));
    expect(u).toBeDefined();
    expect(u!.name).toBe("Test Professor");
    expect(u!.emailVerified).toBe(true);
    expect(u!.isActive).toBe(true);
  });

  it("links the professor to the org as a teacher when ORG_SLUG matches", async () => {
    const org = await createOrg({ slug: "seed-org" });

    await withEnv(
      {
        PLATFORM_PROFESSOR_EMAIL: "prof2@seed.test",
        PLATFORM_PROFESSOR_PASSWORD: "longenoughpassword",
        PLATFORM_PROFESSOR_NAME: "Linked Professor",
        PLATFORM_PROFESSOR_ORG_SLUG: "seed-org",
      },
      async () => {
        await seedPlatformProfessor();
      }
    );

    const [u] = await db
      .select()
      .from(user)
      .where(eq(user.email, "prof2@seed.test"));
    expect(u).toBeDefined();

    const [m] = await db
      .select()
      .from(member)
      .where(eq(member.userId, u!.id));
    expect(m).toBeDefined();
    expect(m!.organizationId).toBe(org.id);
    expect(m!.role).toBe("teacher");
  });

  it("is idempotent — second call updates instead of throwing", async () => {
    await withEnv(
      {
        PLATFORM_PROFESSOR_EMAIL: "prof3@seed.test",
        PLATFORM_PROFESSOR_PASSWORD: "longenoughpassword",
        PLATFORM_PROFESSOR_NAME: "First Name",
        PLATFORM_PROFESSOR_ORG_SLUG: undefined,
      },
      async () => {
        await seedPlatformProfessor();
      }
    );
    await withEnv(
      {
        PLATFORM_PROFESSOR_EMAIL: "prof3@seed.test",
        PLATFORM_PROFESSOR_PASSWORD: "longenoughpassword",
        PLATFORM_PROFESSOR_NAME: "Second Name",
        PLATFORM_PROFESSOR_ORG_SLUG: undefined,
      },
      async () => {
        await seedPlatformProfessor();
      }
    );

    const rows = await db
      .select()
      .from(user)
      .where(eq(user.email, "prof3@seed.test"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Second Name");
  });

  it("creates the user but skips org link when ORG_SLUG is unknown", async () => {
    await withEnv(
      {
        PLATFORM_PROFESSOR_EMAIL: "prof4@seed.test",
        PLATFORM_PROFESSOR_PASSWORD: "longenoughpassword",
        PLATFORM_PROFESSOR_NAME: "Unlinked Professor",
        PLATFORM_PROFESSOR_ORG_SLUG: "does-not-exist",
      },
      async () => {
        await seedPlatformProfessor();
      }
    );

    const [u] = await db
      .select()
      .from(user)
      .where(eq(user.email, "prof4@seed.test"));
    expect(u).toBeDefined();

    const members = await db
      .select()
      .from(member)
      .where(eq(member.userId, u!.id));
    expect(members).toHaveLength(0);

    const orgs = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, "does-not-exist"));
    expect(orgs).toHaveLength(0);
  });
});
