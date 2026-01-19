# src/types/ Directory Guide

This directory contains TypeScript type definitions shared across the application.

## Files

### index.ts

Main type definitions file.

#### Theme Type
```typescript
interface Theme {
  id: string;      // Theme identifier (e.g., "vs-dark")
  label: string;   // Display name (e.g., "VS Dark")
  color: string;   // Background color for preview
}
```

#### Language Types
```typescript
interface Language {
  id: string;              // Language identifier
  label: string;           // Display name
  logoPath: string;        // Path to language logo
  monacoLanguage: string;  // Monaco editor language ID
  defaultCode: string;     // Default code template
  pistonRuntime: LanguageRuntime;
}

interface LanguageRuntime {
  language: string;  // Piston API language name
  version: string;   // Runtime version
}
```

#### Execution Types
```typescript
interface ExecuteCodeResponse {
  compile?: {
    output: string;
  };
  run?: {
    output: string;
    stderr: string;
  };
}

interface ExecutionResult {
  code: string;        // Executed code
  output: string;      // Stdout output
  error: string | null; // Error message if any
}
```

#### Code Editor State
```typescript
interface CodeEditorState {
  language: string;
  output: string;
  input: string;
  isRunning: boolean;
  error: string | null;
  theme: string;
  fontSize: number;
  editor: MonacoEditor.IStandaloneCodeEditor | null;
  executionResult: ExecutionResult | null;

  // Actions
  setEditor: (editor) => void;
  getCode: () => string;
  getInput: () => string;
  setInput: (input: string) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: string) => void;
  setFontSize: (fontSize: number) => void;
  runCode: () => Promise<void>;
}
```

## Usage

```typescript
import type { Theme, Language, ExecutionResult } from "@/types"

const myTheme: Theme = {
  id: "custom",
  label: "Custom Theme",
  color: "#1a1a1a"
}
```

## Conventions

- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and simple aliases
- Export types from a single index file for easy imports
- Prefix imported types with `type` keyword when possible:
  ```typescript
  import type { Theme } from "@/types"
  ```

## Adding New Types

1. Define types in `index.ts` (or create new file for complex domains)
2. Export from the file
3. Import using `@/types` alias
