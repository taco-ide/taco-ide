import { and, eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { member } from "@repo/infra/db/schema";

/**
 * Whether the caller may grant or remove the organization `admin` role in
 * `organizationId`: platform admins, or current `admin` members of that
 * organization. Matches Better Auth's creator-role rule (only `admin` members
 * may assign `admin`) for writes that product routes apply directly.
 *
 * The membership is read from the database, not from the session cookie, so a
 * revoked admin cannot keep this privilege through the session cache.
 */
export async function canManageOrgAdminRole(
  caller: { id: string; isPlatformAdmin: boolean },
  organizationId: string
): Promise<boolean> {
  if (caller.isPlatformAdmin) return true;

  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, caller.id))
    )
    .limit(1);

  return row?.role === "admin";
}

export const ADMIN_ROLE_FORBIDDEN_MESSAGE =
  "Only platform admins or organization admins can grant or remove the admin role";
