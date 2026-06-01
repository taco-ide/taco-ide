"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Nav() {
  const t = useTranslations("home.nav");

  const links = [
    { href: "#teachers", label: t("teachers") },
    { href: "#demo", label: t("ide") },
    { href: "#ai", label: t("ai") },
    { href: "#oss", label: t("oss") },
  ];

  return (
    <header className="sticky top-0 z-[60] border-b border-white/10 bg-[#1A1F2E]/[0.78] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TACO">
          <Image
            src="/header-logo.png"
            alt="TACO"
            width={120}
            height={30}
            priority
            className="h-[30px] w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] text-gray-300 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative py-1.5 transition-colors hover:text-white"
            >
              {link.label}
              <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#4CAF50] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <LanguageSwitcher />
          <Link
            href="/auth/login"
            className="hidden text-[13px] text-gray-300 transition-colors hover:text-white sm:inline"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#4CAF50] to-[#45A049] px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {t("startFree")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Nav;
