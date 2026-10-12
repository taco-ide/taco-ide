import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { asc, eq, like, sql } from "drizzle-orm";
import { hashPassword } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { account, member, user } from "@repo/infra/db/schema";
import { seedCredential } from "@repo/infra/db/seeds/credentials";
import { seedPlatformAdmin } from "@repo/infra/db/seeds/admin";
import { loginAs } from "../../../../../test/helpers/auth";
import { getApp } from "../../../../../test/helpers/app";
import {
  addMember,
  createOrg,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

const repositoryPath = fileURLToPath(
  new URL("../../../../../../../../", import.meta.url),
);
const normalization = readFileSync(
  new URL(
    "../../../../../../../../packages/infra/drizzle/0010_credential_account_identifiers.sql",
    import.meta.url,
  ),
  "utf8",
);
const adminOptions = {
  PLATFORM_ADMIN_EMAIL: "platform-admin@test.local",
  PLATFORM_ADMIN_PASSWORD: "InitialAdmin123!@",
  PLATFORM_ADMIN_NAME: "Platform admin",
};

describe("canonical credential account identifiers", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  async function signIn(prefix: string, email: string, password: string) {
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/sign-in/email`,
      payload: { email, password },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBeDefined();
    return response;
  }

  it("creates test credentials that sign in with the current Better Auth version", async () => {
    const actor = await createUser();
    const [credential] = await db
      .select()
      .from(account)
      .where(eq(account.userId, actor.id));
    expect(credential?.accountId).toBe(actor.id);
    await signIn("/api/auth", actor.email, TEST_PASSWORD);
  });

  it.each(["/api/auth", "/v1/auth"])(
    "normalizes legacy credentials without changing identity or hash, then signs in through %s",
    async (prefix) => {
      const actor = await createUser();
      const org = await createOrg();
      const membership = await addMember(actor.id, org.id, "admin");
      await db
        .update(account)
        .set({ accountId: actor.email })
        .where(eq(account.userId, actor.id));
      const [before] = await db
        .select()
        .from(account)
        .where(eq(account.userId, actor.id));
      const oauthId = randomUUID();
      await db.insert(account).values({
        id: oauthId,
        userId: actor.id,
        accountId: "provider-subject-id",
        providerId: "google",
      });
      const [oauthBefore] = await db
        .select()
        .from(account)
        .where(eq(account.id, oauthId));

      await db.execute(sql.raw(normalization));
      await db.execute(sql.raw(normalization)); // Idempotent data migration.

      const [after] = await db
        .select()
        .from(account)
        .where(eq(account.id, before!.id));
      expect(after).toEqual({ ...before, accountId: actor.id });
      const [oauthAfter] = await db
        .select()
        .from(account)
        .where(eq(account.id, oauthId));
      expect(oauthAfter).toEqual(oauthBefore);
      const [membershipAfter] = await db
        .select()
        .from(member)
        .where(eq(member.id, membership.id));
      expect(membershipAfter).toEqual(membership);
      await signIn(prefix, actor.email, TEST_PASSWORD);
    },
  );

  it("aborts the entire normalization when a user has multiple credentials", async () => {
    const first = await createUser();
    const ambiguous = await createUser();
    await db
      .update(account)
      .set({ accountId: first.email })
      .where(eq(account.userId, first.id));
    await db.insert(account).values({
      id: randomUUID(),
      userId: ambiguous.id,
      accountId: ambiguous.email,
      providerId: "credential",
      password: await hashPassword(TEST_PASSWORD),
    });
    const before = await db.select().from(account).orderBy(asc(account.id));

    await expect(db.execute(sql.raw(normalization))).rejects.toMatchObject({
      cause: {
        code: "P0001",
        message:
          "Ambiguous credential accounts: multiple credentials for one user; resolve duplicates before retrying normalization",
      },
    });
    expect(await db.select().from(account).orderBy(asc(account.id))).toEqual(
      before,
    );
  });

  it("repairs an existing seeded credential while preserving its current password", async () => {
    const actor = await createUser();
    await db
      .update(account)
      .set({ accountId: actor.email })
      .where(eq(account.userId, actor.id));
    const [before] = await db
      .select()
      .from(account)
      .where(eq(account.userId, actor.id));

    await seedCredential({ userId: actor.id, password: "DoNotReset123!@" });
    await seedCredential({ userId: actor.id, password: "DoNotReset123!@" });

    const credentials = await db
      .select()
      .from(account)
      .where(eq(account.userId, actor.id));
    expect(credentials).toEqual([{ ...before, accountId: actor.id }]);
    await signIn("/api/auth", actor.email, TEST_PASSWORD);
  });

  it("creates a new production admin credential using its canonical user id", async () => {
    await seedPlatformAdmin(adminOptions);
    const [admin] = await db
      .select()
      .from(user)
      .where(eq(user.email, adminOptions.PLATFORM_ADMIN_EMAIL));
    expect(admin?.isPlatformAdmin).toBe(true);
    const [credential] = await db
      .select()
      .from(account)
      .where(eq(account.userId, admin!.id));
    expect(credential?.accountId).toBe(admin?.id);
    await signIn(
      "/api/auth",
      adminOptions.PLATFORM_ADMIN_EMAIL,
      adminOptions.PLATFORM_ADMIN_PASSWORD,
    );
  });

  it("repairs the legacy production admin without resetting its password or changing its id", async () => {
    const admin = await createUser({
      email: adminOptions.PLATFORM_ADMIN_EMAIL,
      isPlatformAdmin: true,
      password: adminOptions.PLATFORM_ADMIN_PASSWORD,
    });
    await db
      .update(account)
      .set({ accountId: admin.email })
      .where(eq(account.userId, admin.id));
    const [before] = await db
      .select()
      .from(account)
      .where(eq(account.userId, admin.id));

    await seedPlatformAdmin(adminOptions);
    await seedPlatformAdmin(adminOptions);

    const [after] = await db
      .select()
      .from(account)
      .where(eq(account.id, before!.id));
    expect(after).toEqual({ ...before, accountId: admin.id });
    const [adminAfter] = await db
      .select()
      .from(user)
      .where(eq(user.email, admin.email));
    expect(adminAfter?.id).toBe(admin.id);
    await signIn("/v1/auth", admin.email, adminOptions.PLATFORM_ADMIN_PASSWORD);
  });

  it("preserves the admin seed's explicit password rotation contract", async () => {
    const admin = await createUser({
      email: adminOptions.PLATFORM_ADMIN_EMAIL,
      isPlatformAdmin: true,
    });
    const [before] = await db
      .select()
      .from(account)
      .where(eq(account.userId, admin.id));

    await seedPlatformAdmin(adminOptions);

    const [after] = await db
      .select()
      .from(account)
      .where(eq(account.userId, admin.id));
    expect(after?.id).toBe(before?.id);
    expect(after?.accountId).toBe(admin.id);
    expect(after?.password).not.toBe(before?.password);
    await signIn(
      "/api/auth",
      admin.email,
      adminOptions.PLATFORM_ADMIN_PASSWORD,
    );
    const oldPasswordResponse = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: admin.email, password: TEST_PASSWORD },
    });
    expect(oldPasswordResponse.statusCode).toBe(401);
  });

  it("rejects ambiguous seeded credentials without changing user privileges or account rows", async () => {
    const actor = await createUser({
      email: adminOptions.PLATFORM_ADMIN_EMAIL,
    });
    await db.insert(account).values({
      id: randomUUID(),
      userId: actor.id,
      accountId: actor.email,
      providerId: "credential",
      password: await hashPassword(TEST_PASSWORD),
    });
    const before = await db.select().from(account).orderBy(asc(account.id));

    await expect(seedPlatformAdmin(adminOptions)).rejects.toThrow(
      /Ambiguous credential accounts/,
    );
    expect(await db.select().from(account).orderBy(asc(account.id))).toEqual(
      before,
    );
    const [actorAfter] = await db
      .select()
      .from(user)
      .where(eq(user.id, actor.id));
    expect(actorAfter).toMatchObject({
      name: actor.name,
      isPlatformAdmin: false,
    });
  });

  it("creates CSV-imported members with credentials that can sign in", async () => {
    const admin = await createUser({ isPlatformAdmin: true });
    const organization = await createOrg();
    const cookie = await loginAs({
      email: admin.email,
      password: TEST_PASSWORD,
    });
    const importedPassword = "ImportedUser123!@";
    const boundary = "credential-import-test";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="members.csv"',
      "Content-Type: text/csv",
      "",
      `name,email,role,password\nImported Student,imported@test.local,student,${importedPassword}`,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const response = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organization.id}/members/import-csv`,
      headers: {
        cookie,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { summary: { created: 1, errors: 0 } },
    });
    const [imported] = await db
      .select()
      .from(user)
      .where(eq(user.email, "imported@test.local"));
    expect(imported).toBeDefined();
    const [credential] = await db
      .select()
      .from(account)
      .where(eq(account.userId, imported!.id));
    expect(credential?.accountId).toBe(imported?.id);
    await signIn("/api/auth", "imported@test.local", importedPassword);
  });

  it("repairs all dev and demo seeded credentials on rerun without resetting passwords", async () => {
    function runDevSeed() {
      const seedEnvironment: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: "test",
      };
      delete seedEnvironment.PLATFORM_ADMIN_EMAIL;
      delete seedEnvironment.PLATFORM_ADMIN_PASSWORD;
      delete seedEnvironment.PLATFORM_ADMIN_NAME;
      execFileSync(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "packages/infra/src/db/seeds/dev.ts"],
        {
          cwd: repositoryPath,
          env: seedEnvironment,
          stdio: "pipe",
        },
      );
    }

    runDevSeed();
    const seedUsers = await db
      .select()
      .from(user)
      .where(like(user.email, "%@taco-demo.local"));
    expect(seedUsers).toHaveLength(7);
    const customPassword = "KeepExisting123!@";
    for (const seededUser of seedUsers) {
      await db
        .update(account)
        .set({ accountId: seededUser.email })
        .where(eq(account.userId, seededUser.id));
    }
    await db
      .update(account)
      .set({ password: await hashPassword(customPassword) })
      .where(eq(account.userId, seedUsers[0]!.id));
    const before = await db.select().from(account).orderBy(asc(account.id));

    runDevSeed();

    const after = await db.select().from(account).orderBy(asc(account.id));
    expect(after).toEqual(
      before.map((credential) => ({
        ...credential,
        accountId: credential.userId,
      })),
    );
    await signIn("/api/auth", seedUsers[0]!.email, customPassword);
    for (const seededUser of seedUsers.slice(1)) {
      await signIn("/api/auth", seededUser.email, TEST_PASSWORD);
    }
  });
});
