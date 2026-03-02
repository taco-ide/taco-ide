"use client";

import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import RunningCodeSkeleton from "./RunningCodeSkeleton";

function OutputPanel() {
  const { output, error, isRunning } = useCodeEditorStore();
  const [isCopied, setIsCopied] = useState(false);

  const hasContent = error || output;

  const handleCopy = async () => {
    if (!hasContent) return;
    await navigator.clipboard.writeText(error || output);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <span className="text-xs font-medium text-zinc-400 flex items-center gap-2">
          <Terminal className="size-3.5" />
          Output
        </span>
        {hasContent && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-400 rounded transition-colors"
          >
            {isCopied ? (
              <>
                <CheckCircle className="size-3.5" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copiar
              </>
            )}
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-4">
          <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/40 p-4 font-mono text-sm min-h-[120px]">
            {isRunning ? (
              <RunningCodeSkeleton />
            ) : error ? (
              <div className="flex items-start gap-3 text-rose-400/90">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium">Erro de execução</div>
                  <pre className="whitespace-pre-wrap text-rose-400/80 text-xs">
                    {error}
                  </pre>
                </div>
              </div>
            ) : output ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400/90 mb-2">
                  <CheckCircle className="size-5" />
                  <span className="font-medium text-sm">Execução concluída</span>
                </div>
                <pre className="whitespace-pre-wrap text-zinc-400 text-xs">
                  {output}
                </pre>
              </div>
            ) : (
              <div className="h-full min-h-[80px] flex flex-col items-center justify-center text-zinc-500">
                <Clock className="size-8 mb-2 opacity-60" />
                <p className="text-xs">Execute o código para ver o output</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutputPanel;
