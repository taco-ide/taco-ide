"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  defineMonacoThemes,
  LANGUAGE_CONFIG,
} from "@/app/problem/[id]/_constants";
import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import Editor from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import Image from "next/image";
import { Code2 } from "lucide-react";

const EDITOR_LANG = "python" as const;

type ReplayCodeColumnProps = {
  code: string;
  stepIndex: number;
};

export function ReplayCodeColumn({ code, stepIndex }: ReplayCodeColumnProps) {
  const theme = useCodeEditorStore((s) => s.theme);
  const fontSize = useCodeEditorStore((s) => s.fontSize);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorHeightPx, setEditorHeightPx] = useState(320);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => {
      const h = node.getBoundingClientRect().height;
      setEditorHeightPx(Math.max(180, Math.floor(h)));
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== code) {
      editor.setValue(code);
    }
    requestAnimationFrame(() => {
      editor.layout();
    });
  }, [code, stepIndex, editorHeightPx]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-slate-700 bg-slate-800/40 text-slate-100 shadow-none">
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
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div
          ref={containerRef}
          className="min-h-0 w-full flex-1 overflow-hidden"
        >
          <Editor
            height={editorHeightPx}
            width="100%"
            className="block w-full"
            value={code}
            language={LANGUAGE_CONFIG[EDITOR_LANG].monacoLanguage}
            theme={theme || "vs-dark"}
            beforeMount={defineMonacoThemes}
            onMount={(editor) => {
              editorRef.current = editor;
              editor.setValue(code);
              requestAnimationFrame(() => editor.layout());
            }}
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
