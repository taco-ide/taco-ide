"use client";

import { useWatch, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StepReferenceSolutionsProps {
  challengeId: string;
  mode: "create" | "edit";
}

export function StepReferenceSolutions({
  challengeId,
  mode,
}: StepReferenceSolutionsProps) {
  const { register, getValues } = useFormContext();
  const generateReferenceSolutions = useWatch({
    name: "generateReferenceSolutions",
  });

  const isChecked = generateReferenceSolutions ?? (mode === "create");

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          Soluções de referência
        </h2>
        <p className="text-slate-400">
          {mode === "create"
            ? "Gere automaticamente soluções de referência para este desafio"
            : "Regenere as soluções de referência para este desafio"}
        </p>
      </div>

      <div className="flex flex-row items-start space-x-3 rounded-md border border-slate-700 p-4">
        <input
          type="checkbox"
          defaultValue={isChecked ? "on" : "off"}
          {...register("generateReferenceSolutions")}
          className="mt-1 w-4 h-4 cursor-pointer"
        />
        <div className="space-y-1 flex-1">
          <Label className="text-slate-200 block">
            {mode === "create"
              ? "Gerar soluções de referência automaticamente ao salvar (recomendado)"
              : "Regenerar soluções de referência ao salvar"}
          </Label>
          <p className="text-xs text-slate-400">
            {mode === "create"
              ? "Gera 2 soluções — uma simples (brute force) e uma refinada — usadas pela avaliação automática."
              : "Marque se você alterou o enunciado e quer que as soluções sejam regeneradas ao salvar. Gera 2 soluções."}
          </p>
        </div>
      </div>

      {mode === "create" && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-300">
          <AlertDescription>
            As soluções serão geradas em background após salvar. Você poderá
            editá-las manualmente ou regenerar a partir da tela de edição do
            desafio.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
