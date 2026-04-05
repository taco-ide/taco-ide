import { CodeEditorState } from "../types/index";
import { create } from "zustand";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  isLegacyEditorTemplate,
  LANGUAGE_CONFIG,
} from "@/app/problem/[id]/_constants";

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
  if (localStorage.getItem("editor-language") !== "python") {
    localStorage.setItem("editor-language", "python");
  }
  const savedLanguage = "python";
  const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";
  const savedFontSize = localStorage.getItem("editor-font-size") || 16;
  const savedInput = localStorage.getItem("editor-input") || "";

  return {
    language: savedLanguage,
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

    getCode: () => get().editor?.getValue() || "",

    getInput: () => get().input,

    setInput: (input: string) => {
      localStorage.setItem("editor-input", input);
      set({ input });
    },

    setEditor: (editor: MonacoEditor.IStandaloneCodeEditor) => {
      // Editor do desafio é só Python — chave fixa (evita restos de `editor-language` antigo).
      let savedCode = localStorage.getItem("editor-code-python");
      if (savedCode && isLegacyEditorTemplate(savedCode)) {
        localStorage.removeItem("editor-code-python");
        savedCode = null;
      }
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
      const { getCode, getInput } = get();
      const code = getCode();
      const stdin = getInput();

      if (!code) {
        set({ error: "Please enter some code" });
        return;
      }

      set({ isRunning: true, error: null, output: "" });

      try {
        const runtime = LANGUAGE_CONFIG.python.pistonRuntime;
        // TODO: update this to use our own API in the future
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

        console.log("data back from piston:", data);

        // handle API-level erros
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
            executionResult: {
              code,
              output: "",
              error,
            },
          });
          return;
        }

        if (data.run && data.run.code !== 0) {
          const error = data.run.stderr || data.run.output;
          set({
            error,
            executionResult: {
              code,
              output: "",
              error,
            },
          });
          return;
        }

        // if we get here, execution was successful
        const output = data.run.output;

        set({
          output: output.trim(),
          error: null,
          executionResult: {
            code,
            output: output.trim(),
            error: null,
          },
        });
      } catch (error) {
        console.log("Error running code:", error);
        set({
          error: "Error running code",
          executionResult: { code, output: "", error: "Error running code" },
        });
      } finally {
        set({ isRunning: false });
      }
    },

    clearProblemSessionStorage: () => {
      if (typeof window === "undefined") return;
      for (const key of Object.keys(LANGUAGE_CONFIG)) {
        localStorage.removeItem(`editor-code-${key}`);
      }
      localStorage.setItem("editor-input", "");
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

export const getExecutionResult = () =>
  useCodeEditorStore.getState().executionResult;
