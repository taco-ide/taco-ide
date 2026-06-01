"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  /** Hide the globe icon (e.g. very tight navbars). */
  hideIcon?: boolean;
}

/**
 * Segmented EN | PT toggle. Self-styled for dark surfaces so it looks correct
 * both on the landing glass nav and the in-app navbar without depending on
 * theme tokens. Persists the choice through a cookie (server action) and
 * refreshes the tree so every server/client component re-renders translated.
 */
export function LanguageSwitcher({ className, hideIcon }: LanguageSwitcherProps) {
  const active = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === active || isPending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-0.5",
        isPending && "opacity-60",
        className
      )}
      role="group"
      aria-label="Language"
    >
      {!hideIcon && (
        <Globe className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-gray-400" aria-hidden />
      )}
      {locales.map((loc) => {
        const isActive = loc === active;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => change(loc)}
            disabled={isPending}
            aria-pressed={isActive}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
              isActive
                ? "bg-[#FFB800] text-[#1A1F2E]"
                : "text-gray-400 hover:text-white"
            )}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSwitcher;
