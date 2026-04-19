"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defineMonacoThemes, LANGUAGE_CONFIG } from "@/app/problem/[id]/_constants";
import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import useMounted from "@/hooks/useMounted";
import Editor from "@monaco-editor/react";
import Image from "next/image";
import { Code2 } from "lucide-react";

const EDITOR_LANG = "python" as const;

type ReplayCodeColumnProps = {
  code: string;
};

export function ReplayCodeColumn({ code }: ReplayCodeColumnProps) {
  const mounted = useMounted();
  const theme = useCodeEditorStore((s) => s.theme);
  const fontSize = useCodeEditorStore((s) => s.fontSize);
  if (!mounted) {
    return (
      <Card className="flex h-full min-h-[320px] flex-col border-slate-700 bg-slate-800/40 lg:min-h-[480px]">
        <CardHeader className="border-b border-slate-700/80 py-3">
          <CardTitle className="text-sm text-slate-300">Código</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0" />
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-[320px] flex-col border-slate-700 bg-slate-800/40 text-slate-100 shadow-none lg:min-h-0">
      <CardHeader className="shrink-0 space-y-0 border-b border-slate-700/80 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800/80">
            <Image
              src={`/${EDITOR_LANG}.png`}
              alt=""
              width={18}
              height={18}
            />
          </div>
          <Code2 className="h-4 w-4 text-amber-500/90" />
          Código
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-[240px] flex-1 flex-col p-0 lg:min-h-0">
        <div className="min-h-[240px] flex-1 lg:min-h-0">
          <Editor
            height="100%"
            className="block min-h-[240px] lg:min-h-[320px]"
            value={code}
            language={LANGUAGE_CONFIG[EDITOR_LANG].monacoLanguage}
            theme={theme}
            beforeMount={defineMonacoThemes}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize,
              automaticLayout: true,
              scrollBeyondLastLine: true,
              padding: { top: 12, bottom: 12 },
              fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
              lineHeight: 1.6,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
