"use client";

import { ReactNode } from "react";
import { useHasMinimumRole } from "@/hooks/usePermission";
import type { RoleName } from "@repo/infra/auth/client";

interface RoleGuardProps {
  minimumRole: RoleName;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ minimumRole, children, fallback = null }: RoleGuardProps) {
  const hasRole = useHasMinimumRole(minimumRole);

  if (!hasRole) return <>{fallback}</>;
  return <>{children}</>;
}
