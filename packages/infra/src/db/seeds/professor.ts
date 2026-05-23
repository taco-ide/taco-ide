/**
 * Platform professor seed: idempotently provisions the professor user
 * configured via PLATFORM_PROFESSOR_EMAIL / PLATFORM_PROFESSOR_PASSWORD /
 * PLATFORM_PROFESSOR_NAME. If any of the three is missing, the seed logs a
 * warning and skips without throwing — running `npm run db:seed` in CI or
 * local without the envs is a no-op for this step.
 *
 * If PLATFORM_PROFESSOR_ORG_SLUG is set, the seed looks up the organization
 * by slug and upserts a member row with role="teacher". If the org is not found,
 * logs a warning and skips membership without throwing.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { account, user, organization, member } from "../schema/auth";
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

export async function seedPlatformProfessor() {
  const {
    PLATFORM_PROFESSOR_EMAIL,
    PLATFORM_PROFESSOR_PASSWORD,
    PLATFORM_PROFESSOR_NAME,
    PLATFORM_PROFESSOR_ORG_SLUG,
  } = env;

  if (
    !PLATFORM_PROFESSOR_EMAIL ||
    !PLATFORM_PROFESSOR_PASSWORD ||
    !PLATFORM_PROFESSOR_NAME
  ) {
    console.warn(
      "[seed:professor] Skipping — set PLATFORM_PROFESSOR_EMAIL, PLATFORM_PROFESSOR_PASSWORD and PLATFORM_PROFESSOR_NAME to provision the professor"
    );
    return;
  }

  const email = PLATFORM_PROFESSOR_EMAIL.toLowerCase();
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (existing) {
    await db
      .update(user)
      .set({
        name: PLATFORM_PROFESSOR_NAME,
        emailVerified: true,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, existing.id));
    await upsertCredential(existing.id, email, PLATFORM_PROFESSOR_PASSWORD);
    console.log(`[seed:professor] Updated existing platform professor: ${email}`);

    // Handle org membership if slug is provided
    if (PLATFORM_PROFESSOR_ORG_SLUG) {
      const [org] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, PLATFORM_PROFESSOR_ORG_SLUG))
        .limit(1);

      if (org) {
        await db
          .insert(member)
          .values({
            id: randomUUID(),
            organizationId: org.id,
            userId: existing.id,
            role: "teacher",
          })
          .onConflictDoUpdate({
            target: [member.organizationId, member.userId],
            set: { role: "teacher" },
          });
        console.log(
          `[seed:professor] Linked professor to org: ${PLATFORM_PROFESSOR_ORG_SLUG}`
        );
      } else {
        console.warn(
          `[seed:professor] Organization not found: ${PLATFORM_PROFESSOR_ORG_SLUG}`
        );
      }
    }

    return;
  }

  const userId = randomUUID();
  await db.insert(user).values({
    id: userId,
    name: PLATFORM_PROFESSOR_NAME,
    email,
    emailVerified: true,
    isActive: true,
  });
  await upsertCredential(userId, email, PLATFORM_PROFESSOR_PASSWORD);
  console.log(`[seed:professor] Created platform professor: ${email}`);

  // Handle org membership if slug is provided
  if (PLATFORM_PROFESSOR_ORG_SLUG) {
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, PLATFORM_PROFESSOR_ORG_SLUG))
      .limit(1);

    if (org) {
      await db.insert(member).values({
        id: randomUUID(),
        organizationId: org.id,
        userId,
        role: "teacher",
      });
      console.log(
        `[seed:professor] Linked professor to org: ${PLATFORM_PROFESSOR_ORG_SLUG}`
      );
    } else {
      console.warn(
        `[seed:professor] Organization not found: ${PLATFORM_PROFESSOR_ORG_SLUG}`
      );
    }
  }
}
