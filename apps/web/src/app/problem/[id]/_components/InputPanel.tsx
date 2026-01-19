"use client";

import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import { Terminal, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card className="bg-[#1a1f2e] text-white flex flex-col h-full">
      <CardHeader className="flex-none">
        <CardTitle>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#1e1e2e] ring-1 ring-gray-800/50">
                <Terminal className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Input</span>
            </div>

            {input && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-300 bg-[#1e1e2e] 
               rounded-lg ring-1 ring-gray-800/50 hover:ring-gray-700/50 transition-all"
              >
                {isCopied ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </>
                )}
              </button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 h-full">
        <div className="h-full w-full">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="relative bg-[#1e1e2e]/50 backdrop-blur-sm border border-[#313244] 
            rounded-xl p-4 h-full w-full font-mono text-sm text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Digite o input aqui..."
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default InputPanel; 