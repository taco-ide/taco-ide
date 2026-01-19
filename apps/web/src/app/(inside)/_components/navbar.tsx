import Image from "next/image";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { useState, useRef, useEffect } from "react";

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
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#1a1f2e]/80 border-b border-white/10">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="">
            <Image
              src="/header-logo.png"
              alt="TACO-IDE Logo"
              width={100}
              height={100}
              priority
              className="transform hover:scale-110 transition-transform duration-300"
            />
          </div>
          {/* <span className="text-2xl font-bold bg-gradient-to-r from-[#FFB800] to-[#FFA000] text-transparent bg-clip-text">
            TACO
          </span> */}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 relative" ref={dropdownRef}>
              <div className="text-white">
                <span className="text-sm text-gray-300">Olá, </span>
                <span className="font-medium">{getFirstName()}</span>
              </div>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="btn btn-ghost btn-circle"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FFB800] to-[#FFA000] flex items-center justify-center text-black font-bold">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
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
