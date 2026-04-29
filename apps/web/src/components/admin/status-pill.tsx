import { cn } from "@/lib/utils";

interface StatusPillProps {
  active: boolean;
  className?: string;
}

export function StatusPill({ active, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-slate-600/40 bg-slate-700/30 text-slate-400",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-400" : "bg-slate-500",
        )}
      />
      {active ? "Ativa" : "Inativa"}
    </span>
  );
}
