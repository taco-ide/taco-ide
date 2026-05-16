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

  // if we're on the client, return values from local storage bc localStorage is a browser API.
  const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";
  const savedFontSize = localStorage.getItem("editor-font-size") || 16;

  return {
    language: "python",
    theme: savedTheme,
    fontSize: Number(savedFontSize),
    input: "",
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
      pyodideService.preload().catch((err) => {
        console.warn("Pyodide preload failed:", err);
        useCodeEditorStore.setState({ pyodideStatus: "error" });
      });
    },

    getCode: () => get().editor?.getValue() || "",

    getInput: () => get().input,

    setInput: (input: string) => {
      set({ input });
    },

    setEditor: (editor: MonacoEditor.IStandaloneCodeEditor) => {
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

          if (result.hasException) {
            const error = result.stderr || "Python execution error";
            set({
              error,
              executionResult: { code, output: "", error },
            });
          } else {
            const output = result.stdout.trim();
            set({
              output,
              error: null,
              executionResult: { code, output, error: null },
            });
          }
        } else {
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

          if (data.message) {
            set({
              error: data.message,
              executionResult: { code, output: "", error: data.message },
            });
            return;
          }

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

    clearProblemSessionStorage: () => {
      if (typeof window === "undefined") return;
      const defaultCode = LANGUAGE_CONFIG.python.defaultCode;
      get().editor?.setValue(defaultCode);
      set({
        input: "",
        output: "",
        error: null,
        executionResult: null,
      });
    },
  };
});

if (typeof window !== "undefined") {
  pyodideService.onStatusChange((status) => {
    useCodeEditorStore.setState({ pyodideStatus: status });
  });
}

export const getExecutionResult = () =>
  useCodeEditorStore.getState().executionResult;
