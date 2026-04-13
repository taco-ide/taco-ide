"use client";

import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  Loader2,
  Terminal,
  Keyboard,
} from "lucide-react";
import { useState } from "react";
import RunningCodeSkeleton from "./RunningCodeSkeleton";

function OutputSection() {
  const { output, error, isRunning, pyodideStatus, language } = useCodeEditorStore();
  const [isCopied, setIsCopied] = useState(false);
  const hasContent = error || output;
  const isPythonLoading = isRunning && language === 'python' && pyodideStatus === 'loading';

  const handleCopy = async () => {
    if (!hasContent) return;
    await navigator.clipboard.writeText(error || output);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
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
        <div className="p-3">
          <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/40 p-3 font-mono text-sm min-h-[80px]">
            {isRunning ? (
              isPythonLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60px] text-zinc-500">
                  <Loader2 className="size-5 mb-1 animate-spin opacity-60" />
                  <p className="text-xs">Carregando runtime Python (apenas na primeira vez)...</p>
                </div>
              ) : (
                <RunningCodeSkeleton />
              )
            ) : error ? (
              <div className="flex items-start gap-3 text-rose-400/90">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium text-xs">Erro de execução</div>
                  <pre className="whitespace-pre-wrap text-rose-400/80 text-xs">
                    {error}
                  </pre>
                </div>
              </div>
            ) : output ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400/90 mb-2">
                  <CheckCircle className="size-4" />
                  <span className="font-medium text-xs">Execução concluída</span>
                </div>
                <pre className="whitespace-pre-wrap text-zinc-400 text-xs">
                  {output}
                </pre>
              </div>
            ) : (
              <div className="min-h-[60px] flex flex-col items-center justify-center text-zinc-500">
                <Clock className="size-6 mb-1 opacity-60" />
                <p className="text-xs">Execute o código para ver o output</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InputSection() {
  const { input, setInput } = useCodeEditorStore();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!input) return;
    await navigator.clipboard.writeText(input);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col shrink-0 border-t border-zinc-800/60">
      <div className="shrink-0 flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-zinc-400 flex items-center gap-2">
          <Keyboard className="size-3.5" />
          Input (stdin)
        </span>
        {input && (
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
      <div className="p-3 min-h-[100px]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="h-full min-h-[80px] w-full rounded-lg bg-zinc-800/40 border border-zinc-700/40 p-3 font-mono text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
          placeholder="Digite o input aqui..."
        />
      </div>
    </div>
  );
}

export default function IoPanel() {
  return (
    <div className="h-full flex flex-col min-h-0">
      <OutputSection />
      <InputSection />
    </div>
  );
}
