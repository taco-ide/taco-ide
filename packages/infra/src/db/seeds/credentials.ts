import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { account, user } from "../schema/auth";

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface SeedCredentialOptions {
  userId: string;
  password: string;
  credentialId?: string;
  rotateExistingPassword?: boolean;
}

/** Normalize seeded credentials; password rotation is an explicit admin-only opt-in. */
export async function seedCredential(
  options: SeedCredentialOptions,
  transaction?: SeedTransaction,
): Promise<void> {
  if (!transaction) {
    await db.transaction((tx) => seedCredential(options, tx));
    return;
  }

  const { userId, password, credentialId } = options;
  // Serialize seed runs for the same user before inspecting/inserting accounts.
  const [seededUser] = await transaction
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .for("update");
  if (!seededUser)
    throw new Error(`Cannot seed a credential for missing user ${userId}`);

  const credentials = await transaction
    .select({
      id: account.id,
      accountId: account.accountId,
      password: account.password,
    })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential")),
    );

  if (credentials.length > 1) {
    throw new Error(
      `Ambiguous credential accounts for user ${userId}; resolve duplicates before seeding`,
    );
  }

  const existing = credentials[0];
  if (existing) {
    const changes: Partial<typeof account.$inferInsert> = {};
    if (existing.accountId !== userId) changes.accountId = userId;

    if (options.rotateExistingPassword) {
      const matchesConfiguredPassword = existing.password
        ? await verifyPassword({ hash: existing.password, password }).catch(
            (error: unknown) => {
              // An explicitly configured admin password also replaces unsupported
              // legacy hashes; unrelated crypto failures must still abort the seed.
              if (
                error instanceof Error &&
                error.message === "Invalid password hash"
              )
                return false;
              throw error;
            },
          )
        : false;
      if (!matchesConfiguredPassword) {
        changes.password = await hashPassword(password);
        changes.updatedAt = new Date();
      }
    }

    if (Object.keys(changes).length > 0) {
      await transaction
        .update(account)
        .set(changes)
        .where(eq(account.id, existing.id));
    }
    return;
  }

  await transaction.insert(account).values({
    id: credentialId ?? randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(password),
  });
}
