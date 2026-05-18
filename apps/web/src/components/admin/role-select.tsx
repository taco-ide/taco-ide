"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AdminRole } from "./role-badge";

interface RoleSelectProps {
  value: AdminRole;
  onChange: (role: AdminRole) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}

const options: { value: AdminRole; label: string }[] = [
  { value: "student", label: "Aluno" },
  { value: "teacher", label: "Professor" },
  { value: "coordinator", label: "Coordenador" },
  { value: "admin", label: "Administrador" },
];

export function RoleSelect({
  value,
  onChange,
  disabled,
  className,
  triggerClassName,
  ariaLabel,
}: RoleSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as AdminRole)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel ?? "Selecionar papel"}
        className={cn(
          "h-9 border-slate-700 bg-slate-900/60 text-white data-[state=open]:bg-slate-900",
          triggerClassName,
          className,
        )}
      >
        <SelectValue placeholder="Selecionar…" />
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 text-white">
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="text-white focus:bg-slate-800 focus:text-white"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const adminRoleOptions = options;
