import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/60 text-slate-400 border border-slate-700/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        {body && <p className="text-xs text-slate-400 max-w-md">{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
