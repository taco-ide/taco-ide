"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { GitBranch } from "lucide-react";
import collaboratorsData from "@/data/collaborators.json";
import { Reveal } from "./Reveal";

interface Contributor {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio?: string | null;
}

const MAX_AVATARS = 9;

export function OpenSource() {
  const t = useTranslations("home.oss");

  const collaborators = collaboratorsData.collaborators as Contributor[];
  const visible = collaborators.slice(0, MAX_AVATARS);
  const overflow = collaborators.length - MAX_AVATARS;

  const stats = [
    { n: "100%", l: t("stats.openSource") },
    { n: "7", l: t("stats.languages") },
    { n: "MIT", l: t("stats.license") },
    { n: `${collaborators.length}+`, l: t("stats.contributors") },
  ];

  return (
    <section id="oss" className="mx-auto max-w-[1180px] px-6 py-[88px] text-center">
      <Reveal className="mx-auto mb-14 max-w-[620px] text-center">
        <p className="mb-3.5 text-xs uppercase tracking-[0.1em] text-[#4CAF50]">
          {t("eyebrow")}
        </p>
        <h2 className="mb-4 text-[38px] font-extrabold leading-[1.15] tracking-tight text-white">
          {t("title")}{" "}
          <span className="bg-gradient-to-r from-[#FFB800] to-[#FFA000] bg-clip-text text-transparent">
            {t("titleAccent")}
          </span>
        </h2>
        <p className="text-base leading-relaxed text-gray-400">{t("subtitle")}</p>
      </Reveal>

      <Reveal className="mx-auto mb-14 grid max-w-[880px] grid-cols-2 gap-5 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.l}
            className="rounded-[14px] border border-white/10 bg-white/[0.02] px-[18px] py-[26px]"
          >
            <div className="bg-gradient-to-r from-[#FFB800] to-[#FFA000] bg-clip-text text-[34px] font-extrabold tracking-tight text-transparent">
              {stat.n}
            </div>
            <div className="mt-1.5 text-xs text-gray-400">{stat.l}</div>
          </div>
        ))}
      </Reveal>

      <Reveal>
        <p className="mb-5 text-xs uppercase tracking-[0.1em] text-gray-500">
          {t("contributorsTitle")}
        </p>
        <div className="mx-auto mb-9 flex max-w-[720px] flex-wrap justify-center gap-2.5">
          {visible.map((contributor) => (
            <a
              key={contributor.login}
              href={contributor.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="h-11 w-11 overflow-hidden rounded-full ring-2 ring-[#1A1F2E] transition-transform group-hover:scale-110">
                <Image
                  src={contributor.avatar_url}
                  alt={contributor.name || contributor.login}
                  width={44}
                  height={44}
                  className="object-cover"
                />
              </div>
            </a>
          ))}
          {overflow > 0 && (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#1A1F2E] bg-white/[0.06] text-xs text-gray-300">
              {t("more", { count: overflow })}
            </div>
          )}
        </div>
      </Reveal>

      <Reveal className="flex flex-wrap justify-center gap-3.5">
        <a
          href="https://github.com/taco-ide"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FFB800] to-[#FFA000] px-[30px] py-[15px] text-[15px] font-semibold text-[#1A1F2E] transition-transform hover:scale-[1.02]"
        >
          <GitBranch className="h-4 w-4" />
          {t("viewGithub")}
        </a>
        <a
          href="https://github.com/taco-ide"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/10 px-7 py-[14px] text-[15px] font-semibold text-white transition-colors hover:border-[#FFB800]/50 hover:bg-[#FFB800]/[0.06]"
        >
          {t("readDocs")}
        </a>
      </Reveal>
    </section>
  );
}

export default OpenSource;
