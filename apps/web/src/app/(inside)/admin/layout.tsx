"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { AdminSidebar } from "./_components/admin-sidebar";
import { AdminRouteBreadcrumbs } from "./_components/admin-route-breadcrumbs";
import { AccessDenied } from "./_components/access-denied";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useUser();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user?.isPlatformAdmin) {
    return <AccessDenied />;
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] w-full bg-slate-950/40">
      <AdminSidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminRouteBreadcrumbs
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
