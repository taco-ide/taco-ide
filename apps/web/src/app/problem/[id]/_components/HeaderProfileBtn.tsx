"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

function HeaderProfileBtn() {
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 p-2 rounded-lg bg-[#1e1e2e] ring-1 ring-gray-800/50 hover:ring-gray-700/50 transition-all"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User className="w-5 h-5 text-gray-300" />
        <span className="text-sm font-medium text-gray-300">Perfil</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 bg-[#1a1f2e] border border-white/10 rounded-md shadow-lg z-50"
        >
          <div className="py-1">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-white hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  Perfil
                </Link>
                <Link
                  href="/explore"
                  className="block px-4 py-2 text-sm text-white hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  Explorar
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="block px-4 py-2 text-sm text-white hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default HeaderProfileBtn;
