import Image from "next/image";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { useState, useRef, useEffect } from "react";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PlatformAdminGuard } from "@/components/guards/PlatformAdminGuard";

const Navbar = () => {
  const { user, getFirstName, logout } = useUser();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar o dropdown quando clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-50 shrink-0 backdrop-blur-md bg-[#1a1f2e]/80 border-b border-white/10">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="flex items-center shrink-0"
            aria-label="Ir para Explorar"
          >
            <Image
              src="/header-logo.png"
              alt="TACO-IDE Logo"
              width={220}
              height={56}
              priority
              className="h-14 w-auto max-h-14 object-contain object-left transform hover:scale-110 transition-transform duration-300"
            />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-2 mr-4">
            <Link
              href="/explore"
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              Explorar
            </Link>
            <PermissionGuard resource="challenge" action="create">
              <Link
                href="/create"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                Criar
              </Link>
            </PermissionGuard>
            <PlatformAdminGuard>
              <Link
                href="/admin"
                className="px-3 py-1.5 text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded-md transition-colors"
              >
                Admin
              </Link>
            </PlatformAdminGuard>
          </nav>
          {user ? (
            <div className="flex items-center gap-3 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 p-1 pr-2 rounded-full hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label="Menu do utilizador"
                aria-expanded={showDropdown}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FFB800] to-[#FFA000] flex items-center justify-center text-black font-bold">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="text-white pr-1">
                  <span className="text-sm text-gray-300">Olá, </span>
                  <span className="font-medium">{getFirstName()}</span>
                </div>
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1f2e] border border-white/10 rounded-md shadow-lg z-50">
                  <div className="py-1">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-white hover:bg-white/10"
                      onClick={() => setShowDropdown(false)}
                    >
                      Perfil
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login" className="btn btn-primary">
              <Image
                src="/login.png"
                alt="login"
                width={50}
                height={50}
                priority
                className="rounded-xl transform hover:scale-110 transition-transform duration-300"
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
