import { and, asc, eq, gt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import * as schema from "../db/schema";

/**
 * Adds a user with no memberships to the organization whose email-domain rule
 * matches their address. Runs at sign-up, and again when a pending invitation
 * that held the rule back is declined or found expired, so the person doesn't
 * end up with no organization at all.
 *
 * Does nothing when:
 * - no active organization has a rule for the domain;
 * - the user has a pending, unexpired invitation to that organization (they
 *   are about to accept it with the role the inviter chose, and a membership
 *   created now would make the accept fail on the (organization, user)
 *   unique index);
 * - the user already belongs to any organization (the rule is a sign-up
 *   default, not a way to add established users to more organizations).
 */
export async function applyEmailDomainRule(user: {
  id: string;
  email: string;
}): Promise<void> {
  // Use lastIndexOf("@") to handle quoted local parts like
  // `"user@name"@example.com` — split("@")[1] would return the
  // wrong portion in that (rare, but valid per RFC 5321) case.
  const atIndex = user.email.lastIndexOf("@");
  if (atIndex === -1) return;
  const domain = user.email.slice(atIndex + 1).toLowerCase().trim();
  if (!domain) return;

  // Pick the earliest active rule (createdAt ASC). Multiple rules
  // for the same domain across different organizations are allowed
  // by the global UNIQUE(domain, role) only when the role differs;
  // we still tiebreak by createdAt for predictability.
  const [rule] = await db
    .select({
      organizationId: schema.organizationEmailDomain.organizationId,
      role: schema.organizationEmailDomain.role,
    })
    .from(schema.organizationEmailDomain)
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.organizationEmailDomain.organizationId)
    )
    .where(
      and(
        eq(schema.organizationEmailDomain.domain, domain),
        eq(schema.organization.isActive, true)
      )
    )
    .orderBy(asc(schema.organizationEmailDomain.createdAt))
    .limit(1);
  if (!rule) return;

  const [pendingInvite] = await db
    .select({ id: schema.invitation.id })
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.organizationId, rule.organizationId),
        eq(sql`lower(${schema.invitation.email})`, user.email.toLowerCase()),
        eq(schema.invitation.status, "pending"),
        gt(schema.invitation.expiresAt, new Date())
      )
    )
    .limit(1);
  if (pendingInvite) return;

  const [existingMembership] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(eq(schema.member.userId, user.id))
    .limit(1);
  if (existingMembership) return;

  // Defense-in-depth: cap the effective auto-link role at
  // "teacher". Even if a legacy row in `organization_email_domain`
  // still carries role="admin" (e.g. a seed predating the F10
  // migration, or a manual SQL fixture), self-service sign-up must
  // NEVER grant the real org `admin` role to a stranger whose
  // only credential is owning an email at a matching domain.
  // Body validation in
  // apps/api/.../email-domains/create.ts already blocks new
  // "admin" rules; migration 0005 downgrades existing ones.
  // This cap is the last line of defense.
  const effectiveRole: schema.OrganizationEmailDomain["role"] =
    rule.role === "admin" ? "teacher" : rule.role;

  // Insert the membership directly via Drizzle. Going through
  // `auth.api.addMember` would enforce the org plugin's
  // `membershipLimit` (default 100); we want auto-assignment to
  // bypass that for new sign-ups.
  await db
    .insert(schema.member)
    .values({
      id: randomUUID(),
      userId: user.id,
      organizationId: rule.organizationId,
      role: effectiveRole,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
}
