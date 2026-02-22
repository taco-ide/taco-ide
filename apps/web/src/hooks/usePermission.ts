"use client";

import { useUser } from "@/contexts/UserContext";
import {
  hasMinimumRole,
  roleHasPermission,
  isValidRole,
} from "@repo/infra/auth/client";
import type { RoleName, Resource, ActionFor } from "@repo/infra/auth/client";

export function useRole(): RoleName | null {
  const { user } = useUser();
  if (!user?.role || !isValidRole(user.role)) return null;
  return user.role;
}

export function useHasMinimumRole(minimumRole: RoleName): boolean {
  const role = useRole();
  if (!role) return false;
  return hasMinimumRole(role, minimumRole);
}

export function useHasPermission<R extends Resource>(
  resource: R,
  action: ActionFor<R>
): boolean {
  const role = useRole();
  if (!role) return false;
  return roleHasPermission(role, resource, action);
}
