/**
 * Platform admin seed: idempotently provisions the cross-org admin user
 * configured via PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD /
 * PLATFORM_ADMIN_NAME. If any of the three is missing, the seed logs a
 * warning and skips without throwing — running `npm run db:seed` in CI or
 * local without the envs is a no-op for this step.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { user } from "../schema/auth";
import { env } from "../../env";
import { seedCredential } from "./credentials";

type PlatformAdminSeedOptions = Pick<
  typeof env,
  "PLATFORM_ADMIN_EMAIL" | "PLATFORM_ADMIN_PASSWORD" | "PLATFORM_ADMIN_NAME"
>;

export async function seedPlatformAdmin(
  options: PlatformAdminSeedOptions = env,
) {
  const { PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD, PLATFORM_ADMIN_NAME } =
    options;

  if (
    !PLATFORM_ADMIN_EMAIL ||
    !PLATFORM_ADMIN_PASSWORD ||
    !PLATFORM_ADMIN_NAME
  ) {
    console.warn(
      "[seed:admin] Skipping — set PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD and PLATFORM_ADMIN_NAME to provision the admin",
    );
    return;
  }

  const email = PLATFORM_ADMIN_EMAIL.toLowerCase();
  await db.transaction(async (tx) => {
    const existing = await tx.query.user.findFirst({
      where: eq(user.email, email),
    });

    if (existing) {
      await seedCredential(
        {
          userId: existing.id,
          password: PLATFORM_ADMIN_PASSWORD,
          rotateExistingPassword: true,
        },
        tx,
      );
      await tx
        .update(user)
        .set({
          name: PLATFORM_ADMIN_NAME,
          isPlatformAdmin: true,
          emailVerified: true,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(user.id, existing.id));
      console.log(`[seed:admin] Updated existing platform admin: ${email}`);
      return;
    }

    const userId = randomUUID();
    await tx.insert(user).values({
      id: userId,
      name: PLATFORM_ADMIN_NAME,
      email,
      emailVerified: true,
      isActive: true,
      isPlatformAdmin: true,
    });
    await seedCredential({ userId, password: PLATFORM_ADMIN_PASSWORD }, tx);
    console.log(`[seed:admin] Created platform admin: ${email}`);
  });
}
