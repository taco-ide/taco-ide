import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "../_components/LegalDocument";

// TODO(legal): draft LGPD Privacy Notice pending review — see LegalDocument.tsx.
// The data inventory reflects the code as of the draft date (DB schema in
// packages/infra/src/db/schema, processors configured in packages/infra/src/env.ts);
// update it whenever a new processor or data category is added.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("privacy.metaTitle") };
}

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" />;
}
