"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { GitBranch, Globe, Mail } from "lucide-react";

const YEAR = 2025;

type FooterLink = { label: string; href: string };
type FooterColumn = { title: string; links: FooterLink[] };

export function Footer() {
  const t = useTranslations("home.footer");

  const columns: FooterColumn[] = [
    {
      title: t("productTitle"),
      links: [
        { label: t("product.teachers"), href: "#teachers" },
        { label: t("product.ide"), href: "#demo" },
        { label: t("product.ai"), href: "#ai" },
        { label: t("product.languages"), href: "#" },
      ],
    },
    {
      title: t("resourcesTitle"),
      links: [
        { label: t("resources.docs"), href: "https://github.com/taco-ide" },
        { label: t("resources.github"), href: "https://github.com/taco-ide" },
        { label: t("resources.changelog"), href: "#" },
        { label: t("resources.selfHosting"), href: "#" },
      ],
    },
    {
      title: t("companyTitle"),
      links: [
        { label: t("company.about"), href: "#" },
        { label: t("company.contributors"), href: "#oss" },
        { label: t("company.contact"), href: "#" },
        { label: t("company.license"), href: "#" },
      ],
    },
  ];

  const socials = [
    { Icon: GitBranch, label: "Git" },
    { Icon: Globe, label: "Website" },
    { Icon: Mail, label: "Email" },
  ];

  return (
    <footer className="border-t border-white/10 bg-gradient-to-t from-[#151822] to-[#1A1F2E] pb-9 pt-14">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="grid grid-cols-2 gap-8 border-b border-white/10 pb-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Image
              src="/header-logo.png"
              alt="TACO"
              width={136}
              height={34}
              className="mb-4 h-[34px] w-auto object-contain"
            />
            <p className="max-w-[260px] text-[13px] leading-relaxed text-gray-400">
              {t("tagline")}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h5 className="mb-4 text-xs uppercase tracking-[0.08em] text-gray-300">
                {column.title}
              </h5>
              {column.links.map((link) => (
                <a
                  key={`${column.title}-${link.label}`}
                  href={link.href}
                  className="mb-[11px] block text-[13px] text-gray-400 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3.5 pt-6">
          <div className="text-xs text-gray-500">
            {t("copyright", { year: YEAR })}
          </div>
          <div className="flex gap-2">
            {socials.map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/10 text-gray-400 transition-all hover:border-[#FFB800]/50 hover:text-[#FFB800]"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
