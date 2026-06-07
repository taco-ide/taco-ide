"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const organizationFormSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(120, "Nome deve ter no máximo 120 caracteres"),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .max(60, "Slug deve ter no máximo 60 caracteres")
    .regex(
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
      "Use apenas letras minúsculas, números e hífens",
    ),
  logo: z
    .string()
    .max(500, "URL muito longa")
    .url("URL inválida")
    .optional()
    .or(z.literal("")),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface OrganizationFormFieldsProps {
  form: UseFormReturn<OrganizationFormValues>;
  /** When true, slug is auto-generated from name on every name change while slug stays untouched. */
  autoSlug?: boolean;
}

export function OrganizationFormFields({
  form,
  autoSlug = false,
}: OrganizationFormFieldsProps) {
  const t = useTranslations("adminOrgs");
  const {
    register,
    formState: { errors, dirtyFields },
    watch,
    setValue,
  } = form;

  const name = watch("name");
  const slugTouched = !!dirtyFields.slug;

  useEffect(() => {
    if (!autoSlug || slugTouched) return;
    setValue("slug", slugify(name ?? ""), {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [autoSlug, slugTouched, name, setValue]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="org-name" className="text-slate-300">
          {t("form.name.label")}
        </Label>
        <Input
          id="org-name"
          placeholder={t("form.name.placeholder")}
          autoFocus
          {...register("name")}
          className="bg-slate-900 border-slate-700 text-white"
        />
        {errors.name && (
          <p className="text-xs text-red-400">{errors.name.message}</p>
        )}
        <p className="text-[11px] text-slate-500">{t("form.name.hint")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="org-slug" className="text-slate-300">
          {t("form.slug.label")}
        </Label>
        <div className="flex overflow-hidden rounded-md border border-slate-700 bg-slate-900">
          <span className="border-r border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-500">
            taco.dev/o/
          </span>
          <input
            id="org-slug"
            type="text"
            placeholder="ifsp"
            autoComplete="off"
            spellCheck={false}
            {...register("slug")}
            className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none"
          />
        </div>
        {errors.slug && (
          <p className="text-xs text-red-400">{errors.slug.message}</p>
        )}
        <p className="text-[11px] text-slate-500">{t("form.slug.hint")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="org-logo" className="text-slate-300">
          {t.rich("form.logo.label", {
            optional: (chunks) => (
              <span className="text-slate-500 font-normal">{chunks}</span>
            ),
          })}
        </Label>
        <Input
          id="org-logo"
          placeholder={t("form.logo.placeholder")}
          {...register("logo")}
          className="bg-slate-900 border-slate-700 text-white"
        />
        {errors.logo && (
          <p className="text-xs text-red-400">{errors.logo.message}</p>
        )}
        <p className="text-[11px] text-slate-500">{t("form.logo.hint")}</p>
      </div>
    </div>
  );
}
