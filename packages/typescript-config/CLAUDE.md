# TypeScript Config (`@repo/typescript-config`)

## Overview

Shared TypeScript configuration package for the TACO-IDE monorepo. Provides base `tsconfig.json` presets that apps and packages extend.

## Available Configs

| File | Usage |
|------|-------|
| `base.json` | Base config: ES2022 target, strict mode, NodeNext modules |
| `nextjs.json` | Extends base with Next.js-specific settings (JSX, plugins) |
| `react-library.json` | For shared React library packages |

## Key Settings (base.json)

- **Target**: ES2022
- **Module**: NodeNext (with NodeNext resolution)
- **Strict mode**: Enabled
- **`noUncheckedIndexedAccess`**: Enabled for safer index access
- **`skipLibCheck`**: Enabled for faster builds

## Usage

In a consuming package's `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## Modifying

Edit the JSON files directly. Changes affect all consuming packages on next build/typecheck.
