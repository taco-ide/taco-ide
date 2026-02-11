# src/store/ Directory Guide

This directory contains Zustand state management stores.

## Files

### useCodeEditorStore.ts

Main store for the code editor functionality.

#### State Shape
```typescript
interface CodeEditorState {
  language: string;          // Current programming language
  output: string;            // Code execution output
  input: string;             // stdin input for code execution
  isRunning: boolean;        // Code execution in progress
  error: string | null;      // Execution error message
  theme: string;             // Editor theme (vs-dark, monokai, etc.)
  fontSize: number;          // Editor font size
  editor: MonacoEditor | null; // Monaco editor instance
  executionResult: ExecutionResult | null; // Last execution result
}
```

#### Actions
```typescript
setEditor(editor)    // Set Monaco editor instance
getCode()           // Get current code from editor
getInput()          // Get current stdin input
setInput(input)     // Set stdin input
setLanguage(lang)   // Change programming language
setTheme(theme)     // Change editor theme
setFontSize(size)   // Change font size
runCode()           // Execute code via Piston API
```

#### Persistence
The store persists these values to localStorage:
- `editor-language` - Selected language
- `editor-theme` - Selected theme
- `editor-font-size` - Font size
- `editor-input` - Stdin input
- `editor-code-{language}` - Code per language

## Usage

```typescript
import { useCodeEditorStore } from "@/store/useCodeEditorStore"

function MyComponent() {
  // Select specific state
  const language = useCodeEditorStore((state) => state.language)
  const setLanguage = useCodeEditorStore((state) => state.setLanguage)

  // Or get multiple values
  const { language, theme, runCode } = useCodeEditorStore()

  return (
    <button onClick={runCode}>Run Code</button>
  )
}
```

## Code Execution Flow

1. User clicks "Run" button
2. `runCode()` action is called
3. Gets code from editor and input from state
4. Sets `isRunning: true`
5. Sends request to Piston API
6. Handles response (compile errors, runtime errors, success)
7. Updates `output`, `error`, `executionResult`
8. Sets `isRunning: false`

## Supported Languages

Languages are configured in `src/app/problem/[id]/_constants/index.ts`:
- JavaScript
- TypeScript
- Python
- Java
- Go
- Rust
- C++
- C#
- Ruby
- Swift

## Notes

- Code is stored per-language to preserve work when switching
- Uses Piston API (external) for code execution
- TODO: Replace with own API for production
