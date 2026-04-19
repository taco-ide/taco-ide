"use client";

import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import { useEffect, useRef } from "react";
import {
  defineMonacoThemes,
  isLegacyEditorTemplate,
  LANGUAGE_CONFIG,
} from "../_constants";
import type { editor as MonacoEditor } from "monaco-editor";
import { Editor } from "@monaco-editor/react";
import Image from "next/image";
import { RotateCcwIcon, TypeIcon } from "lucide-react";
import useMounted from "@/hooks/useMounted";
import { useProblem } from "@/contexts/ProblemContext";

/** Editor do desafio é só Python; não usar `language` do store (pode estar desatualizado). */
const EDITOR_LANG = "python" as const;
const PYTHON_DEFAULT = LANGUAGE_CONFIG[EDITOR_LANG].defaultCode;

function EditorPanel() {
  const { theme, fontSize, editor, setFontSize, setEditor, setInput } =
    useCodeEditorStore();
  const { challengeId, solution, isSessionEnded } = useProblem();
  const mounted = useMounted();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const nextCode =
      (solution?.code && !isLegacyEditorTemplate(solution.code)
        ? solution.code
        : null)
      || PYTHON_DEFAULT;

    if (editor.getValue() !== nextCode) {
      editor.setValue(nextCode);
    }
  }, [editor, solution?.code]);

  useEffect(() => {
    setInput(solution?.stdin ?? "");
  }, [solution?.stdin, setInput]);

  useEffect(() => {
    const savedFontSize = localStorage.getItem("editor-font-size");
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
  }, [setFontSize]);

  const handleRefresh = () => {
    if (editor) editor.setValue(PYTHON_DEFAULT);
  };

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
              src={`/${EDITOR_LANG}.png`}
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
              disabled={isSessionEnded}
              className="w-16 h-1 bg-zinc-600 rounded cursor-pointer accent-amber-500 disabled:opacity-50"
            />
            <span className="text-xs text-zinc-500 w-5 text-right">
              {fontSize}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isSessionEnded}
            className="p-1.5 hover:bg-zinc-800/60 rounded-md transition-colors text-zinc-500 hover:text-zinc-400 disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Resetar código"
          >
            <RotateCcwIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Editor com flex para preencher espaço */}
      <div className="flex-1 min-h-0 relative min-h-[200px]">
        <Editor
          key={challengeId ?? "editor"}
          height="100%"
          className="block"
          defaultValue={PYTHON_DEFAULT}
          language={LANGUAGE_CONFIG[EDITOR_LANG].monacoLanguage}
          theme={theme}
          beforeMount={defineMonacoThemes}
          onMount={(editor: MonacoEditor.IStandaloneCodeEditor) =>
            setEditor(editor)
          }
          options={{
            readOnly: isSessionEnded,
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
