"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

export function FinalCta() {
  const t = useTranslations("home.final");

  return (
    <section className="relative mx-auto max-w-[1180px] overflow-hidden px-6 py-24">
      <Reveal>
        <div className="final-card relative mx-auto max-w-[900px] overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(42,47,62,0.7),rgba(21,24,34,0.7))] px-10 py-16 text-center">
          {/* yellow halo */}
          <div className="pointer-events-none absolute -top-[140px] left-1/2 h-[320px] w-[420px] -translate-x-1/2 rounded-full bg-[#FFB800] opacity-[0.18] blur-[96px]" />

          <h2 className="relative mb-4 text-[42px] font-extrabold leading-[1.12] tracking-tight text-white">
            {t("title")}{" "}
            <span className="bg-gradient-to-r from-[#FFB800] to-[#FFA000] bg-clip-text text-transparent">
              {t("titleAccent")}
            </span>
          </h2>

          <p className="relative mx-auto mb-8 max-w-[520px] text-[17px] leading-relaxed text-gray-300">
            {t("subtitle")}
          </p>

          <div className="relative flex flex-wrap justify-center gap-3.5">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#4CAF50] to-[#45A049] px-[30px] py-[15px] text-[15px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("ctaPrimary")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/explore"
              className="rounded-full border border-white/10 px-7 py-[14px] text-[15px] font-semibold text-white transition-colors hover:border-[#FFB800]/50 hover:bg-[#FFB800]/[0.06]"
            >
              {t("ctaSecondary")}
            </Link>
          </div>

          <div className="relative mt-5 text-xs text-gray-500">{t("note")}</div>
        </div>
      </Reveal>
    </section>
  );
}

export default FinalCta;
