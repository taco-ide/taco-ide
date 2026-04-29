/**
 * Platform admin seed: idempotently provisions the cross-org admin user
 * configured via PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD /
 * PLATFORM_ADMIN_NAME. If any of the three is missing, the seed logs a
 * warning and skips without throwing — running `npm run db:seed` in CI or
 * local without the envs is a no-op for this step.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { account, user } from "../schema/auth";
import { env } from "../../env";

async function upsertCredential(
  userId: string,
  email: string,
  password: string
) {
  const passwordHash = await hashPassword(password);
  const existing = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "credential")),
  });

  if (existing) {
    await db
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(account.id, existing.id));
    return;
  }

  await db.insert(account).values({
    id: randomUUID(),
    accountId: email,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
}

export async function seedPlatformAdmin() {
  const { PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD, PLATFORM_ADMIN_NAME } =
    env;

  if (!PLATFORM_ADMIN_EMAIL || !PLATFORM_ADMIN_PASSWORD || !PLATFORM_ADMIN_NAME) {
    console.warn(
      "[seed:admin] Skipping — set PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD and PLATFORM_ADMIN_NAME to provision the admin"
    );
    return;
  }

  const email = PLATFORM_ADMIN_EMAIL.toLowerCase();
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (existing) {
    await db
      .update(user)
      .set({
        name: PLATFORM_ADMIN_NAME,
        isPlatformAdmin: true,
        emailVerified: true,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, existing.id));
    await upsertCredential(existing.id, email, PLATFORM_ADMIN_PASSWORD);
    console.log(`[seed:admin] Updated existing platform admin: ${email}`);
    return;
  }

  const userId = randomUUID();
  await db.insert(user).values({
    id: userId,
    name: PLATFORM_ADMIN_NAME,
    email,
    emailVerified: true,
    isActive: true,
    isPlatformAdmin: true,
  });
  await upsertCredential(userId, email, PLATFORM_ADMIN_PASSWORD);
  console.log(`[seed:admin] Created platform admin: ${email}`);
}
