"use client";

import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import { useEffect, useRef, useCallback } from "react";
import { defineMonacoThemes, LANGUAGE_CONFIG } from "../_constants";
import type { editor as MonacoEditor } from "monaco-editor";
import { Editor } from "@monaco-editor/react";
import Image from "next/image";
import { RotateCcwIcon, TypeIcon } from "lucide-react";
import useMounted from "@/hooks/useMounted";
import { useProblem } from "@/contexts/ProblemContext";

function EditorPanel() {
  const { language, theme, fontSize, editor, setFontSize, setEditor, setInput } =
    useCodeEditorStore();
  const { solution, saveSolution } = useProblem();
  const mounted = useMounted();
  const hasLoadedSolution = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCode = localStorage.getItem(`editor-code-${language}`);
    const newCode = savedCode || LANGUAGE_CONFIG[language].defaultCode;
    if (editor) editor.setValue(newCode);
  }, [language, editor]);

  useEffect(() => {
    if (solution?.code && editor && !hasLoadedSolution.current) {
      editor.setValue(solution.code);
      hasLoadedSolution.current = true;
    }
  }, [solution?.code, editor]);

  useEffect(() => {
    if (solution?.stdin) setInput(solution.stdin);
  }, [solution?.stdin, setInput]);

  useEffect(() => {
    const savedFontSize = localStorage.getItem("editor-font-size");
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
  }, [setFontSize]);

  const handleRefresh = () => {
    const defaultCode = LANGUAGE_CONFIG[language].defaultCode;
    if (editor) editor.setValue(defaultCode);
    localStorage.removeItem(`editor-code-${language}`);
    hasLoadedSolution.current = false;
  };

  const debouncedSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value) {
        localStorage.setItem(`editor-code-${language}`, value);
        if (debouncedSave.current) clearTimeout(debouncedSave.current);
        debouncedSave.current = setTimeout(() => {
          saveSolution({ code: value });
        }, 1000);
      }
    },
    [language, saveSolution]
  );

  const handleFontSizeChange = (newSize: number) => {
    const size = Math.min(Math.max(newSize, 12), 24);
    setFontSize(size);
    localStorage.setItem("editor-font-size", size.toString());
  };

  if (!mounted) return null;

  return (
    <div ref={containerRef} className="h-full flex flex-col min-h-0 rounded-lg border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      {/* Header compacto */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-zinc-800/60">
            <Image
              src={"/" + language + ".png"}
              alt="Logo"
              width={18}
              height={18}
            />
          </div>
          <div>
            <h2 className="text-xs font-medium text-zinc-300">Editor</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800/40 rounded-md">
            <TypeIcon className="size-3.5 text-zinc-500" />
            <input
              type="range"
              min="12"
              max="24"
              value={fontSize}
              onChange={(e) =>
                handleFontSizeChange(parseInt(e.target.value))
              }
              className="w-16 h-1 bg-zinc-600 rounded cursor-pointer accent-amber-500"
            />
            <span className="text-xs text-zinc-500 w-5 text-right">
              {fontSize}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-zinc-800/60 rounded-md transition-colors text-zinc-500 hover:text-zinc-400"
            aria-label="Resetar código"
          >
            <RotateCcwIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Editor com flex para preencher espaço */}
      <div className="flex-1 min-h-0 relative min-h-[200px]">
        <Editor
          height="100%"
          className="block"
          language={LANGUAGE_CONFIG[language].monacoLanguage}
          onChange={handleEditorChange}
          theme={theme}
          beforeMount={defineMonacoThemes}
          onMount={(editor: MonacoEditor.IStandaloneCodeEditor) =>
            setEditor(editor)
          }
          options={{
            minimap: { enabled: false },
            fontSize,
            automaticLayout: true,
            scrollBeyondLastLine: true,
            padding: { top: 12, bottom: 12 },
            renderWhitespace: "selection",
            fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
            fontLigatures: true,
            cursorBlinking: "smooth",
            smoothScrolling: true,
            contextmenu: true,
            renderLineHighlight: "all",
            lineHeight: 1.6,
            letterSpacing: 0.5,
            roundedSelection: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>
    </div>
  );
}
export default EditorPanel;
