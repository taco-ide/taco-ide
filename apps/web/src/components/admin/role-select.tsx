"use client";

import { useTranslations } from "next-intl";
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

const roleOrder: AdminRole[] = ["student", "teacher", "coordinator", "admin"];

export function RoleSelect({
  value,
  onChange,
  disabled,
  className,
  triggerClassName,
  ariaLabel,
}: RoleSelectProps) {
  const t = useTranslations("adminShared");
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as AdminRole)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel ?? t("roleSelect.ariaLabel")}
        className={cn(
          "h-9 border-slate-700 bg-slate-900/60 text-white data-[state=open]:bg-slate-900",
          triggerClassName,
          className,
        )}
      >
        <SelectValue placeholder={t("roleSelect.placeholder")} />
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 text-white">
        {roleOrder.map((role) => (
          <SelectItem
            key={role}
            value={role}
            className="text-white focus:bg-slate-800 focus:text-white"
          >
            {t(`role.${role}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const adminRoleOptions: { value: AdminRole }[] = roleOrder.map(
  (value) => ({ value }),
);
