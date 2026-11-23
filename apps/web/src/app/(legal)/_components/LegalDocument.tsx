import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";

// TODO(legal): every string rendered here lives under `legal` in
// src/messages/{en,pt}.json and is a DRAFT. Before removing the draft banner,
// the controller must review the text and fill in all [BRACKETED]
// placeholders: controller name, contact email / encarregado, ethics committee
// (CEP/CAAE) approval number, legal bases, retention period, hosting provider,
// transfer safeguards, procedure for minors, license and jurisdiction.
const DRAFT_VERSION = "2026-11-22";

export type LegalDoc = "terms" | "privacy";

type Section = { title: string; body?: string[]; items?: string[] };

const OTHER_DOC: Record<LegalDoc, string> = {
  terms: "/privacy",
  privacy: "/terms",
};

/** Highlights "[PLACEHOLDER]" segments that still need to be filled in. */
function WithPlaceholders({ text }: { text: string }) {
  return text.split(/(\[[^\]]+\])/).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <mark
        key={i}
        className="rounded bg-[#FFB800]/15 px-1 text-[#FFB800]"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export async function LegalDocument({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("legal");
  const sections = t.raw(`${doc}.sections`) as Section[];

  return (
    <article className="text-[15px] leading-relaxed text-gray-300">
      <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
        {t(`${doc}.title`)}
      </h1>
      <p className="mb-8 text-xs text-gray-500">
        {t("version", { date: DRAFT_VERSION })}
      </p>

      <div
        role="note"
        className="mb-10 flex gap-3 rounded-lg border border-[#FFB800]/40 bg-[#FFB800]/10 p-4 text-sm"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB800]" />
        <div>
          <p className="font-semibold text-[#FFB800]">{t("draft.title")}</p>
          <p className="mt-1 text-gray-300">{t("draft.body")}</p>
        </div>
      </div>

      <p className="mb-10">{t(`${doc}.intro`)}</p>

      {sections.map((section) => (
        <section key={section.title} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-white">
            {section.title}
          </h2>
          {section.body?.map((paragraph) => (
            <p key={paragraph} className="mb-3">
              <WithPlaceholders text={paragraph} />
            </p>
          ))}
          {section.items && (
            <ul className="mb-3 list-disc space-y-2 pl-5 marker:text-[#4CAF50]">
              {section.items.map((item) => (
                <li key={item}>
                  <WithPlaceholders text={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="mt-12 border-t border-white/10 pt-6 text-sm text-gray-400">
        {t.rich(`otherDoc.${doc}`, {
          link: (chunks) => (
            <Link
              href={OTHER_DOC[doc]}
              className="text-[#4CAF50] underline underline-offset-4 hover:text-white"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </article>
  );
}
