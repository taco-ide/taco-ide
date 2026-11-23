import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "../_components/LegalDocument";

// TODO(legal): draft Terms of Use pending review — see LegalDocument.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("terms.metaTitle") };
}

export default function TermsPage() {
  return <LegalDocument doc="terms" />;
}
