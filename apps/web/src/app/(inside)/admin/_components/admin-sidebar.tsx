"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { AvatarSquare } from "@/components/admin/avatar-square";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Building2;
}

const navItems: NavItem[] = [
  { href: "/admin/organizations", label: "Organizações", icon: Building2 },
  { href: "/admin/users", label: "Usuários", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname() ?? "";
  const { user, logout } = useUser();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-6 border-r border-slate-800/80 bg-slate-950/60 p-4">
      <Link href="/admin" className="flex items-center gap-2 px-2 py-1.5">
        <Image
          src="/header-logo.png"
          alt="TACO"
          width={84}
          height={28}
          priority
          className="h-7 w-auto"
        />
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          Admin
        </span>
      </Link>

      <nav className="flex flex-col gap-2">
        <div className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Plataforma
        </div>
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-amber-500/10 text-amber-200"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-amber-300" : "text-slate-400 group-hover:text-slate-200",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
        <AvatarSquare name={user?.name ?? "Admin"} src={user?.image} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-white">
            {user?.name ?? "Admin"}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <ShieldCheck className="h-3 w-3 text-amber-300" />
            Platform Admin
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void logout();
          }}
          className="text-slate-400 hover:text-white"
          title="Sair"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
