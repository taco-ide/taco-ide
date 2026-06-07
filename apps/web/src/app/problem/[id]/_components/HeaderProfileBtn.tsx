"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { useTranslations } from "next-intl";

function HeaderProfileBtn() {
  const { user, getFirstName, logout } = useUser();
  const t = useTranslations("problem");
  const c = useTranslations("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        aria-label={t("profileMenu.label")}
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center text-zinc-900 font-bold text-sm select-none">
          {initial}
        </div>
        {user && (
          <span className="hidden sm:block text-sm font-medium text-gray-300 max-w-[100px] truncate">
            {getFirstName()}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50">
          <div className="py-1">
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
              onClick={() => setOpen(false)}
            >
              {t("profileMenu.profile")}
            </Link>
            <Link
              href="/explore"
              className="block px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
              onClick={() => setOpen(false)}
            >
              {t("profileMenu.explore")}
            </Link>
            <div className="border-t border-zinc-700 my-1" />
            <button
              type="button"
              onClick={() => { setOpen(false); void logout(); }}
              className="block w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-zinc-800 transition-colors"
            >
              {c("signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default HeaderProfileBtn;
