/**
 * Invitation fixtures for the accept-invitation e2e spec. Like seed.ts, these
 * write straight to the dev database the stack under test is using.
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://dbuser:dbpass@localhost:5490/taco_dev";

/** Seeded by `db:seed:dev` (packages/infra/src/db/seeds/dev.ts). */
const SEED_USER_COORD = "33333333-3333-3333-3333-333333330003";

const DAY_MS = 24 * 60 * 60 * 1000;

function connect() {
  return postgres(DEV_DATABASE_URL, { max: 1 });
}

/** Creates a throwaway organization so tests never touch the seeded one. */
export async function createE2eOrganization(name: string): Promise<string> {
  const sql = connect();
  try {
    const id = randomUUID();
    await sql`
      INSERT INTO organization (id, name, slug, created_at)
      VALUES (${id}, ${name}, ${`e2e-${id.slice(0, 8)}`}, NOW())
    `;
    return id;
  } finally {
    await sql.end();
  }
}

export async function createInvitation(opts: {
  organizationId: string;
  email: string;
  role?: string;
  status?: "pending" | "canceled";
  expired?: boolean;
}): Promise<string> {
  const sql = connect();
  try {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + (opts.expired ? -DAY_MS : 7 * DAY_MS));
    await sql`
      INSERT INTO invitation (id, email, inviter_id, organization_id, role, status, expires_at, created_at)
      VALUES (${id}, ${opts.email.toLowerCase()}, ${SEED_USER_COORD}, ${opts.organizationId},
              ${opts.role ?? "teacher"}, ${opts.status ?? "pending"}, ${expiresAt}, NOW())
    `;
    return id;
  } finally {
    await sql.end();
  }
}

export async function findMembershipRole(
  email: string,
  organizationId: string
): Promise<string | null> {
  const sql = connect();
  try {
    const [row] = await sql<{ role: string }[]>`
      SELECT m.role FROM member m
      JOIN "user" u ON u.id = m.user_id
      WHERE lower(u.email) = ${email.toLowerCase()} AND m.organization_id = ${organizationId}
      LIMIT 1
    `;
    return row?.role ?? null;
  } finally {
    await sql.end();
  }
}

/**
 * Removes what the spec created. Deleting the organization cascades to its
 * members and invitations; sessions that still point at it fall back to the
 * user's oldest active membership (apps/api auth middleware).
 */
export async function cleanupInvitationFixtures(opts: {
  organizationIds: string[];
  userEmails: string[];
}): Promise<void> {
  const sql = connect();
  try {
    if (opts.userEmails.length) {
      await sql`DELETE FROM "user" WHERE lower(email) IN ${sql(opts.userEmails.map((e) => e.toLowerCase()))}`;
    }
    if (opts.organizationIds.length) {
      await sql`DELETE FROM organization WHERE id IN ${sql(opts.organizationIds)}`;
    }
  } finally {
    await sql.end();
  }
}
