import Link from "next/link";
import ThemeSelector from "./ThemeSelector";
import RunButton from "./RunButton";
import HeaderProfileBtn from "./HeaderProfileBtn";
import Image from "next/image";

function Header() {
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
