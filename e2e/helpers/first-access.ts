/**
 * Fixtures for the first-access (no organization) screen. Each test creates
 * its own throwaway user and organizations directly in the dev database and
 * removes them afterwards, so the specs never touch the seeded accounts.
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";
import { PROFESSOR } from "./seed";

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://dbuser:dbpass@localhost:5490/taco_dev";

export const FIRST_ACCESS_PASSWORD = "FirstAccess123!@";

export interface FirstAccessFixtures {
  user: { id: string; email: string; password: string };
  createOrganization: (opts?: {
    isActive?: boolean;
  }) => Promise<{ id: string; name: string }>;
  addMembership: (organizationId: string, role?: string) => Promise<void>;
  createInvitation: (organizationId: string, role?: string) => Promise<string>;
  cleanup: () => Promise<void>;
}

/**
 * Creates a verified credential user with no memberships and returns helpers
 * to attach organizations, memberships and invitations to it.
 */
export async function createFirstAccessUser(): Promise<FirstAccessFixtures> {
  const sql = postgres(DEV_DATABASE_URL, { max: 1 });
  const suffix = randomUUID().slice(0, 8);
  const userId = randomUUID();
  const email = `first-access-${suffix}@e2e.taco.local`;
  const organizationIds: string[] = [];

  await sql`
    INSERT INTO "user" (id, name, email, email_verified)
    VALUES (${userId}, ${`First Access ${suffix}`}, ${email}, true)
  `;
  await sql`
    INSERT INTO account (id, account_id, provider_id, user_id, password)
    VALUES (${randomUUID()}, ${userId}, 'credential', ${userId},
            ${await hashPassword(FIRST_ACCESS_PASSWORD)})
  `;

  return {
    user: { id: userId, email, password: FIRST_ACCESS_PASSWORD },

    async createOrganization({ isActive = true } = {}) {
      const id = randomUUID();
      const slug = `e2e-first-access-${randomUUID().slice(0, 8)}`;
      const name = `E2E Institution ${slug.slice(-8)}`;
      await sql`
        INSERT INTO organization (id, name, slug, is_active)
        VALUES (${id}, ${name}, ${slug}, ${isActive})
      `;
      organizationIds.push(id);
      return { id, name };
    },

    async addMembership(organizationId, role = "student") {
      await sql`
        INSERT INTO member (id, user_id, organization_id, role)
        VALUES (${randomUUID()}, ${userId}, ${organizationId}, ${role})
      `;
    },

    async createInvitation(organizationId, role = "student") {
      const id = randomUUID();
      await sql`
        INSERT INTO invitation
          (id, email, inviter_id, organization_id, role, status, expires_at)
        VALUES
          (${id}, ${email}, ${PROFESSOR.id}, ${organizationId}, ${role},
           'pending', NOW() + INTERVAL '2 days')
      `;
      return id;
    },

    async cleanup() {
      try {
        // Sessions, accounts, memberships and invitations cascade.
        await sql`DELETE FROM "user" WHERE id = ${userId}`;
        if (organizationIds.length > 0) {
          await sql`DELETE FROM organization WHERE id IN ${sql(organizationIds)}`;
        }
      } finally {
        await sql.end();
      }
    },
  };
}
