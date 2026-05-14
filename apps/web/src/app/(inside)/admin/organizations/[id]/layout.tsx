"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useGetV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { Button } from "@/components/ui/button";
import { OrgHeader } from "./_components/org-header";
import { OrgTabsNav } from "./_components/org-tabs-nav";

export default function OrganizationDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const { data, isLoading, error } = useGetV1OrganizationsId(id, {
    query: { enabled: id.length > 0 },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline-dark" size="sm">
          <Link href="/admin/organizations">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
        </Button>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Não foi possível carregar a organização.{" "}
          {error instanceof Error ? error.message : ""}
        </div>
      </div>
    );
  }

  const org = data.data;

  return (
    <div className="space-y-6">
      <OrgHeader org={org} />
      <OrgTabsNav orgId={org.id} />
      <div>{children}</div>
    </div>
  );
}
