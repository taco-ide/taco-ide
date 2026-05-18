"use client";

import { cn } from "@/lib/utils";

interface AdminToggleProps {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

/**
 * Small accessible on/off toggle used by the admin pages (e.g. platform admin
 * row toggle on /admin/users).
 */
export function AdminToggle({
  checked,
  onClick,
  disabled,
  ariaLabel,
  className,
}: AdminToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40",
        checked
          ? "border-amber-400/40 bg-amber-500/30"
          : "border-slate-600/60 bg-slate-700/40",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-1",
        )}
      />
    </button>
  );
}
