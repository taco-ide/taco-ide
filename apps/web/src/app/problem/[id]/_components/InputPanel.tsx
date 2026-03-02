"use client";

import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import { Keyboard, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";

function InputPanel() {
  const { input, setInput } = useCodeEditorStore();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!input) return;
    await navigator.clipboard.writeText(input);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
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
      <div className="flex-1 min-h-0 p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="h-full w-full rounded-lg bg-zinc-800/40 border border-zinc-700/40 p-4 font-mono text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
          placeholder="Digite o input aqui..."
        />
      </div>
    </div>
  );
}

export default InputPanel;
