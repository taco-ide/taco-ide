"use client";

import { useParams } from "next/navigation";
import { Info, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGetV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { useGetV1OrganizationsIdEmailDomains } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdEmailDomains";
import { AddDomainForm } from "./_components/add-domain-form";
import { DomainsTable } from "./_components/domains-table";

export default function OrganizationDomainsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const orgQuery = useGetV1OrganizationsId(id, {
    query: { enabled: id.length > 0 },
  });
  const orgName = orgQuery.data?.data.name ?? "esta organização";

  const domainsQuery = useGetV1OrganizationsIdEmailDomains(id, {
    query: { enabled: id.length > 0 },
  });

  const rows = domainsQuery.data?.data ?? [];
  const isLoading = domainsQuery.isLoading;

  return (
    <div className="space-y-5">
      <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-100">
        <Info className="h-4 w-4 text-amber-400" />
        <AlertTitle className="text-white">
          Vínculo automático por domínio
        </AlertTitle>
        <AlertDescription className="text-slate-300">
          Usuários que se cadastrarem com um email cujo domínio bata com um dos
          abaixo serão adicionados a{" "}
          <strong className="text-white">{orgName}</strong> automaticamente, com
          o papel definido. A regra com a data de criação mais antiga vence
          quando há múltiplas correspondências.
        </AlertDescription>
      </Alert>

      <AddDomainForm organizationId={id} />

      {domainsQuery.isError ? (
        <Alert variant="destructive" className="border-red-500/30 bg-red-500/5">
          <AlertTitle className="text-red-200">
            Erro ao carregar domínios
          </AlertTitle>
          <AlertDescription className="text-red-300">
            <div className="mb-3">
              {domainsQuery.error instanceof Error
                ? domainsQuery.error.message
                : "Tente novamente em instantes."}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => domainsQuery.refetch()}
              disabled={domainsQuery.isFetching}
              className="border-red-500/40 text-red-200 hover:bg-red-500/10 hover:text-red-100"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  domainsQuery.isFetching ? "animate-spin" : ""
                }`}
              />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DomainsTable
          organizationId={id}
          rows={rows}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
