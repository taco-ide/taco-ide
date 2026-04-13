import { CodeEditorState } from "../types/index";
import { create } from "zustand";
import type { editor as MonacoEditor } from "monaco-editor";
import { LANGUAGE_CONFIG } from "@/app/problem/[id]/_constants";
import { pyodideService } from "@/lib/pyodide";

const getInitialState = () => {
  // if we're on the server, return default values
  if (typeof window === "undefined") {
    return {
      language: "python",
      fontSize: 16,
      theme: "vs-dark",
      input: "",
    };
  }

  const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";
  const savedFontSize = localStorage.getItem("editor-font-size") || 16;
  const savedInput = localStorage.getItem("editor-input") || "";

  return {
    language: "python",
    theme: savedTheme,
    fontSize: Number(savedFontSize),
    input: savedInput,
  };
};

export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
  const initialState = getInitialState();

  return {
    ...initialState,
    output: "",
    isRunning: false,
    error: null,
    editor: null,
    executionResult: null,
    pyodideStatus: "idle",

    preloadPyodide: () => {
      pyodideService.preload().catch(() => {});
    },

    getCode: () => {
      const editorValue = get().editor?.getValue();
      if (editorValue) return editorValue;
      // Fallback: read from localStorage (saved on every keystroke by EditorPanel)
      if (typeof window !== "undefined") {
        return localStorage.getItem(`editor-code-${get().language}`) || "";
      }
      return "";
    },

    getInput: () => get().input,

    setInput: (input: string) => {
      localStorage.setItem("editor-input", input);
      set({ input });
    },

    setEditor: (editor: MonacoEditor.IStandaloneCodeEditor) => {
      // TODO: Save code based on the problem on the database
      const savedCode = localStorage.getItem(`editor-code-${get().language}`);
      if (savedCode) editor.setValue(savedCode);

      set({ editor });
    },

    setTheme: (theme: string) => {
      localStorage.setItem("editor-theme", theme);
      set({ theme });
    },

    setFontSize: (fontSize: number) => {
      localStorage.setItem("editor-font-size", fontSize.toString());
      set({ fontSize });
    },

    setLanguage: (language: string) => {
      // Save current language code before switching
      const currentCode = get().editor?.getValue();
      if (currentCode) {
        localStorage.setItem(`editor-code-${get().language}`, currentCode);
      }

      localStorage.setItem("editor-language", language);

      set({
        language,
        output: "",
        error: null,
      });
    },

    runCode: async () => {
      const { language, getCode, getInput } = get();
      const code = getCode();
      const stdin = getInput();

      if (!code) {
        set({ error: "Please enter some code" });
        return;
      }

      set({ isRunning: true, error: null, output: "" });

      try {
        if (language === "python") {
          const result = await pyodideService.execute(code, stdin);
          const hasError = result.stderr.trim().length > 0;

          if (hasError) {
            set({
              error: result.stderr,
              executionResult: { code, output: "", error: result.stderr },
            });
          } else {
            set({
              output: result.stdout.trim(),
              error: null,
              executionResult: { code, output: result.stdout.trim(), error: null },
            });
          }
        } else {
          // Piston API for non-Python languages
          const runtime = LANGUAGE_CONFIG[language].pistonRuntime;
          const response = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              language: runtime.language,
              version: runtime.version,
              files: [{ content: code }],
              stdin,
            }),
          });

          const data = await response.json();

          // handle API-level errors
          if (data.message) {
            set({
              error: data.message,
              executionResult: { code, output: "", error: data.message },
            });
            return;
          }

          // handle compilation errors
          if (data.compile && data.compile.code !== 0) {
            const error = data.compile.stderr || data.compile.output;
            set({
              error,
              executionResult: { code, output: "", error },
            });
            return;
          }

          if (data.run && data.run.code !== 0) {
            const error = data.run.stderr || data.run.output;
            set({
              error,
              executionResult: { code, output: "", error },
            });
            return;
          }

          const output = data.run.output;
          set({
            output: output.trim(),
            error: null,
            executionResult: { code, output: output.trim(), error: null },
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error running code";
        set({
          error: message,
          executionResult: { code, output: "", error: message },
        });
      } finally {
        set({ isRunning: false });
      }
    },
  };
});

// Subscribe to Pyodide status changes and sync to store
if (typeof window !== "undefined") {
  pyodideService.onStatusChange((status) => {
    useCodeEditorStore.setState({ pyodideStatus: status });
  });
}

export const getExecutionResult = () =>
  useCodeEditorStore.getState().executionResult;
