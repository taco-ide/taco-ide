"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, GraduationCap } from "lucide-react";

export function Hero() {
  const t = useTranslations("home.hero");

  const trust = [
    { label: t("trust.openSource"), lit: true },
    { label: t("trust.selfHostable"), lit: false },
    { label: t("trust.noData"), lit: false },
    { label: t("trust.free"), lit: false },
  ];

  return (
    <section className="relative overflow-hidden px-6 pb-[76px] pt-[104px] text-center">
      {/* halos */}
      <div className="pointer-events-none absolute -top-[120px] right-[4%] h-[460px] w-[460px] animate-pulse rounded-full bg-[#FFB800] opacity-[0.18] blur-[96px]" />
      <div className="pointer-events-none absolute -bottom-[160px] left-[2%] h-[420px] w-[420px] animate-pulse rounded-full bg-[#4CAF50] opacity-20 blur-[96px] [animation-delay:1s]" />
      {/* grid */}
      <div
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,#000_30%,transparent_75%)]"
      />

      <div className="relative mx-auto max-w-[860px]">
        <div className="mb-[26px] inline-flex items-center gap-2 rounded-full border border-[#4CAF50]/25 bg-[#4CAF50]/[0.08] py-1.5 pl-2 pr-3.5 text-xs tracking-wide text-gray-300">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4CAF50]/[0.16] px-2.5 py-0.5 font-semibold text-[#4CAF50]">
            <GraduationCap className="h-3.5 w-3.5" />
            {t("eyebrowPill")}
          </span>
          {t("eyebrowText")}
        </div>

        <h1 className="mb-[22px] text-[40px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[60px]">
          {t("titleLine1")}
          <br />
          <span className="bg-gradient-to-r from-[#FFB800] to-[#FFA000] bg-clip-text text-transparent">
            {t("titleAccent")}
          </span>
        </h1>

        <p className="mx-auto mb-9 max-w-[660px] text-[18px] leading-relaxed text-gray-300">
          {t("subtitle")}
        </p>

        <div className="flex flex-wrap justify-center gap-3.5">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#4CAF50] to-[#45A049] px-[30px] py-[15px] text-[15px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {t("ctaPrimary")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#demo"
            className="rounded-full border border-white/10 bg-transparent px-7 py-[14px] text-[15px] font-semibold text-white transition-colors hover:border-[#FFB800]/50 hover:bg-[#FFB800]/[0.06]"
          >
            {t("ctaSecondary")}
          </a>
        </div>

        <div className="mt-[30px] flex flex-wrap items-center justify-center gap-x-[22px] gap-y-2 text-xs text-gray-500">
          {trust.map((item, i) => (
            <span key={item.label} className="flex items-center gap-[22px]">
              <span className={item.lit ? "text-gray-300" : undefined}>
                {item.label}
              </span>
              {i < trust.length - 1 && (
                <span className="h-1 w-1 rounded-full bg-gray-500" />
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Hero;
