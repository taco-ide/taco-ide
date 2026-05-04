import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function AdminBreadcrumbs({ items }: AdminBreadcrumbsProps) {
  return (
    <nav aria-label="Caminho" className="flex items-center gap-1.5 text-sm text-slate-400">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <Fragment key={`${idx}-${item.label}`}>
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="rounded px-1 py-0.5 hover:text-white"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-white font-medium" : undefined}>
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
