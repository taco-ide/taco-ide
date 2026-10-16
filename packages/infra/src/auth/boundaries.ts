import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";

const administrativeUserFields = ["isActive", "deletedAt", "isPlatformAdmin"];

export function rejectAdministrativeUserFields(body: unknown): void {
  if (!body || typeof body !== "object") return;

  if (administrativeUserFields.some((field) => Object.hasOwn(body, field))) {
    throw new APIError("BAD_REQUEST", {
      message: "Administrative user fields cannot be changed through self-service authentication",
    });
  }
}

export async function requireActiveAccount(userId: string) {
  const [account] = await db
    .select({
      isActive: user.isActive,
      deletedAt: user.deletedAt,
      isPlatformAdmin: user.isPlatformAdmin,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!account?.isActive || account.deletedAt !== null) {
    throw new APIError("FORBIDDEN", { message: "User account is disabled" });
  }

  return account;
}

export async function requireActivePlatformAdmin(userId: string): Promise<void> {
  const account = await requireActiveAccount(userId);
  if (!account.isPlatformAdmin) {
    throw new APIError("FORBIDDEN", { message: "Platform admin access required" });
  }
}
