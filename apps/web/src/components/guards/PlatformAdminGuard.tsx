"use client";

import { ReactNode } from "react";
import { useUser } from "@/contexts/UserContext";

interface PlatformAdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only when the current user is a platform admin.
 * While the session is loading, renders nothing to avoid flicker.
 */
export function PlatformAdminGuard({
  children,
  fallback = null,
}: PlatformAdminGuardProps) {
  const { user, isLoading } = useUser();

  if (isLoading) return null;
  if (!user?.isPlatformAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
