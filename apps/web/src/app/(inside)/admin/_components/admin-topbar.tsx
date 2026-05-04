"use client";

import { Bell, CircleHelp, Menu, Search } from "lucide-react";
import type { BreadcrumbItem } from "./admin-breadcrumbs";
import { AdminBreadcrumbs } from "./admin-breadcrumbs";

interface AdminTopbarProps {
  breadcrumbs: BreadcrumbItem[];
  /** Called when the user opens the mobile sidebar via the hamburger button. */
  onOpenMobileSidebar?: () => void;
}

export function AdminTopbar({
  breadcrumbs,
  onOpenMobileSidebar,
}: AdminTopbarProps) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-slate-800/80 bg-slate-950/40 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800/60 hover:text-white lg:hidden"
        title="Abrir menu"
        aria-label="Abrir menu"
      >
        <Menu className="h-4 w-4" />
      </button>
      <AdminBreadcrumbs items={breadcrumbs} />
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
          title="Buscar"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
          title="Ajuda"
          aria-label="Ajuda"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
