"use client";

import { useTranslations } from "next-intl";
import { Check, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "./Reveal";

type Accent = "green" | "yellow";

interface CardItem {
  b: string;
  t: string;
}

interface CardConfig {
  accent: Accent;
  icon: LucideIcon;
  tag: string;
  title: string;
  description: string;
  items: CardItem[];
}

const ACCENT_CLASSES: Record<
  Accent,
  {
    iconBox: string;
    tag: string;
    chip: string;
    cardHover: string;
  }
> = {
  green: {
    iconBox: "bg-[#4CAF50]/12 text-[#4CAF50]",
    tag: "text-[#4CAF50]",
    chip: "bg-[#4CAF50]/[0.14] text-[#4CAF50]",
    cardHover:
      "hover:border-[#4CAF50]/25 hover:shadow-[0_20px_25px_-5px_rgba(76,175,80,0.1)]",
  },
  yellow: {
    iconBox: "bg-[#FFB800]/12 text-[#FFB800]",
    tag: "text-[#FFB800]",
    chip: "bg-[#FFB800]/[0.14] text-[#FFB800]",
    cardHover:
      "hover:border-[#FFB800]/25 hover:shadow-[0_20px_25px_-5px_rgba(255,184,0,0.1)]",
  },
};

function DuoCard({ config }: { config: CardConfig }) {
  const { accent, icon: Icon, tag, title, description, items } = config;
  const accentClasses = ACCENT_CLASSES[accent];

  return (
    <div
      className={`rounded-[18px] border border-white/5 bg-gradient-to-b from-[#2A2F3E] to-[#252A38] p-[34px] transition-all hover:-translate-y-1 ${accentClasses.cardHover}`}
    >
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${accentClasses.iconBox}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <span
        className={`text-[11px] uppercase tracking-[0.08em] ${accentClasses.tag}`}
      >
        {tag}
      </span>
      <h3 className="mb-2.5 mt-2 text-2xl font-bold text-white">{title}</h3>
      <p className="mb-[22px] text-sm leading-relaxed text-gray-400">
        {description}
      </p>
      <ul className="flex flex-col gap-3.5">
        {items.map((item) => (
          <li
            key={item.b}
            className="flex items-start gap-3 text-sm leading-snug text-gray-300"
          >
            <span
              className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${accentClasses.chip}`}
            >
              <Check className="h-3 w-3" />
            </span>
            <span>
              <b className="font-semibold text-white">{item.b}</b> {item.t}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Duo() {
  const t = useTranslations("home.duo");

  const teachers: CardConfig = {
    accent: "green",
    icon: Users,
    tag: t("teachers.tag"),
    title: t("teachers.title"),
    description: t("teachers.description"),
    items: t.raw("teachers.items") as CardItem[],
  };

  const students: CardConfig = {
    accent: "yellow",
    icon: Sparkles,
    tag: t("students.tag"),
    title: t("students.title"),
    description: t("students.description"),
    items: t.raw("students.items") as CardItem[],
  };

  return (
    <section id="teachers" className="py-[88px]">
      <div className="mx-auto max-w-[1180px] px-6">
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
          <p className="text-base leading-relaxed text-gray-400">
            {t("subtitle")}
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-1 items-stretch gap-7 lg:grid-cols-[1.15fr_1fr]">
          <DuoCard config={teachers} />
          <DuoCard config={students} />
        </Reveal>
      </div>
    </section>
  );
}

export default Duo;
