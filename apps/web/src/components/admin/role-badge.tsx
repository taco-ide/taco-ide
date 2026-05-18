import { cn } from "@/lib/utils";

export type AdminRole = "student" | "teacher" | "coordinator" | "admin";

const roleLabel: Record<AdminRole, string> = {
  student: "Aluno",
  teacher: "Professor",
  coordinator: "Coordenador",
  admin: "Administrador",
};

const roleClass: Record<AdminRole, string> = {
  student: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  teacher: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  coordinator: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  admin: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

interface RoleBadgeProps {
  role: AdminRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        roleClass[role],
        className,
      )}
    >
      {roleLabel[role]}
    </span>
  );
}

export function getRoleLabel(role: AdminRole): string {
  return roleLabel[role];
}

export function isAdminRole(value: string): value is AdminRole {
  return value === "student" || value === "teacher" || value === "coordinator" || value === "admin";
}
