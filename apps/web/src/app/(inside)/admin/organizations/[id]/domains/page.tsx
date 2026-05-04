import { Globe } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";

/**
 * Placeholder owned by Agent D (domains tab).
 * Lives here so the Domínios tab does not 404 while the real page is wired.
 */
export default function DomainsTabPlaceholderPage() {
  return (
    <EmptyState
      icon={Globe}
      title="Em construção"
      body="A aba de domínios será entregue em breve pelo agente responsável."
    />
  );
}
