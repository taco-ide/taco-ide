"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/apiClient";
import { usePostV1OrganizationsIdEmailDomains } from "@/kubb/hooks/organizationsHooks/usePostV1OrganizationsIdEmailDomains";
import { getV1OrganizationsIdEmailDomainsQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdEmailDomains";
import type { AdminRole } from "@/components/admin/role-badge";
import { getRoleLabel } from "@/components/admin/role-badge";

interface AddDomainFormProps {
  organizationId: string;
}

// Auto-link rules can NOT grant "admin": signing up with an email matching
// the rule must never make a stranger a real org admin. See backend cap in
// apps/api/src/http/routes/v1/organizations/email-domains/create.ts and the
// runtime defense-in-depth cap in packages/infra/src/auth/index.ts. The
// Kubb-generated request type already excludes "admin" — we narrow
// `AdminRole` to mirror that contract on the client side.
type AutoLinkRole = Exclude<AdminRole, "admin">;

const ROLE_OPTIONS: AutoLinkRole[] = ["student", "teacher", "coordinator"];

const DEFAULT_ROLE: AutoLinkRole = "teacher";

// Mirrors backend normalization in
// apps/api/src/http/routes/v1/organizations/email-domains/create.ts
const domainSchema = z
  .string()
  .min(3, "Domínio precisa ter ao menos 3 caracteres")
  .max(253, "Domínio muito longo")
  .transform((s) => s.toLowerCase().trim().replace(/^@/, ""))
  .refine(
    (s) =>
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
        s,
      ),
    { message: "Formato de domínio inválido (ex.: exemplo.edu.br)" },
  );

export function AddDomainForm({ organizationId }: AddDomainFormProps) {
  const t = useTranslations("adminDomains");
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");
  const [role, setRole] = useState<AutoLinkRole>(DEFAULT_ROLE);
  const [error, setError] = useState<string | null>(null);

  const createMutation = usePostV1OrganizationsIdEmailDomains({
    mutation: {
      onSuccess: (response) => {
        toast.success(t("toast.added", { domain: response.data.domain }));
        setDomain("");
        setRole(DEFAULT_ROLE);
        setError(null);
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdEmailDomainsQueryKey(organizationId),
        });
      },
      onError: (err) => {
        const apiError = err as unknown as ApiError | undefined;
        const status = apiError?.status;
        const message =
          err instanceof Error ? err.message : t("error.addFailed");

        if (status === 409) {
          setError(message);
          return;
        }

        setError(message);
        toast.error(message);
      },
    },
  });

  function reset() {
    setError(null);
  }

  function submit() {
    if (createMutation.isPending) return;

    const parsed = domainSchema.safeParse(domain);
    if (!parsed.success) {
      const message =
        parsed.error.errors[0]?.message ?? t("error.invalidDomain");
      setError(message);
      return;
    }

    setError(null);
    createMutation.mutate({
      id: organizationId,
      data: {
        domain: parsed.data,
        role,
      },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return (
    <Card className="bg-slate-900/60 border-slate-700/60 text-white">
      <CardHeader>
        <CardTitle className="text-base">{t("form.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-start"
          noValidate
        >
          <div className="space-y-1.5">
            <div className="flex items-center rounded-md border border-slate-700/60 bg-slate-950/60 focus-within:border-amber-400/60">
              <span className="select-none px-3 py-2 text-sm text-slate-500">
                @
              </span>
              <Input
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  reset();
                }}
                placeholder={t("form.domainPlaceholder")}
                className="h-10 flex-1 border-0 bg-transparent px-0 text-sm text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label={t("form.domainLabel")}
                aria-invalid={error ? true : undefined}
                disabled={createMutation.isPending}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}
          </div>

          <Select
            value={role}
            onValueChange={(value) => {
              setRole(value as AutoLinkRole);
              reset();
            }}
            disabled={createMutation.isPending}
          >
            <SelectTrigger
              className="h-10 border-slate-700/60 bg-slate-950/60 text-sm text-white"
              aria-label={t("form.roleLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-white">
              {ROLE_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {getRoleLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {t("form.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
