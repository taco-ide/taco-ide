"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut, ShieldCheck, Users, X } from "lucide-react";
import { useEffect } from "react";
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

interface AdminSidebarProps {
  /**
   * Whether the mobile drawer overlay is visible.
   * Desktop sidebar (`lg+`) is always visible regardless of this flag.
   */
  mobileOpen?: boolean;
  /** Called when the user dismisses the mobile drawer. */
  onCloseMobile?: () => void;
}

interface SidebarContentProps {
  pathname: string;
  user: ReturnType<typeof useUser>["user"];
  logout: ReturnType<typeof useUser>["logout"];
  onNavigate?: () => void;
}

function SidebarContent({
  pathname,
  user,
  logout,
  onNavigate,
}: SidebarContentProps) {
  return (
    <>
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-2 px-2 py-1.5"
      >
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
                onClick={onNavigate}
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
                    active
                      ? "text-amber-300"
                      : "text-slate-400 group-hover:text-slate-200",
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
    </>
  );
}

export function AdminSidebar({
  mobileOpen = false,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname() ?? "";
  const { user, logout } = useUser();

  // Close drawer with Escape and lock background scroll while it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile?.();
    };
    window.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-6 border-r border-slate-800/80 bg-slate-950/60 p-4">
        <SidebarContent pathname={pathname} user={user} logout={logout} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col gap-6 border-r border-slate-800/80 bg-slate-950 p-4">
            <button
              type="button"
              onClick={onCloseMobile}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent
              pathname={pathname}
              user={user}
              logout={logout}
              onNavigate={onCloseMobile}
            />
          </aside>
        </div>
      )}
    </>
  );
}
