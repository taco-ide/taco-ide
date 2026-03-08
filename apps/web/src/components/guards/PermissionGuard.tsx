"use client";

import { ReactNode } from "react";
import { useHasPermission } from "@/hooks/usePermission";
import type { Resource, ActionFor } from "@repo/infra/auth/client";

interface PermissionGuardProps<R extends Resource> {
  resource: R;
  action: ActionFor<R>;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard<R extends Resource>({
  resource,
  action,
  children,
  fallback = null,
}: PermissionGuardProps<R>) {
  const hasPermission = useHasPermission(resource, action);

  if (!hasPermission) return <>{fallback}</>;
  return <>{children}</>;
}
