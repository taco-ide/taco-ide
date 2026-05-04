import { Users } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";

/**
 * Placeholder owned by Agent B (members tab).
 * Lives here so the Membros tab does not 404 while the real page is wired.
 */
export default function MembersTabPlaceholderPage() {
  return (
    <EmptyState
      icon={Users}
      title="Em construção"
      body="A aba de membros será entregue em breve pelo agente responsável."
    />
  );
}
