import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Public shell for the Terms of Use and Privacy Notice pages. These routes are
 * whitelisted in `middleware.ts`, so anonymous visitors (e.g. coming from the
 * signup form) can read them.
 */
export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("legal");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F2E] via-[#1A1F2E] to-[#151822] text-white [background-attachment:fixed]">
      <header className="sticky top-0 z-[60] border-b border-white/10 bg-[#1A1F2E]/[0.78] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6">
          <Link href="/" className="flex shrink-0 items-center" aria-label="TACO">
            <Image
              src="/header-logo.png"
              alt="TACO"
              width={120}
              height={30}
              priority
              className="h-[30px] w-auto object-contain"
            />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("nav.backHome")}
        </Link>
        {children}
      </main>

      <footer className="border-t border-white/10 py-6">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-6 px-6 text-xs text-gray-400">
          <Link href="/terms" className="transition-colors hover:text-white">
            {t("nav.terms")}
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white">
            {t("nav.privacy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
