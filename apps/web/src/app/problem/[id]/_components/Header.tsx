import Link from "next/link";
import ThemeSelector from "./ThemeSelector";
import LanguageSelector from "./LanguageSelector";
import RunButton from "./RunButton";
import HeaderProfileBtn from "./HeaderProfileBtn";
import Image from "next/image";
import { useRole } from "@/hooks/usePermission";

function Header() {
  const role = useRole();
  const hasLanguageAccess = role !== null;

  return (
    <header className="shrink-0">
      <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="hidden lg:flex items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/header-logo.png"
              alt="TACO-IDE Logo"
              width={32}
              height={32}
              priority
              className="opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeSelector />
          <LanguageSelector hasAccess={hasLanguageAccess} />
          <RunButton />
          <div className="pl-3 ml-1 border-l border-zinc-700/50">
            <HeaderProfileBtn />
          </div>
        </div>
      </div>
    </header>
  );
}
export default Header;
