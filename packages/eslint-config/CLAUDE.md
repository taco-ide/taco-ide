# ESLint Config (`@repo/eslint-config`)

## Overview

Shared ESLint configuration package for the TACO-IDE monorepo. Provides consistent linting rules across all apps and packages.

## Exported Configs

| Export | File | Usage |
|--------|------|-------|
| `@repo/eslint-config/base` | `base.js` | Base config: ESLint recommended + TypeScript + Prettier + Turbo |
| `@repo/eslint-config/next-js` | `next.js` | Extends base with Next.js and React rules |
| `@repo/eslint-config/react-internal` | `react-internal.js` | React library rules (no Next.js) |

## Key Rules

- Uses ESLint flat config format (ESLint 9+)
- All rules downgraded to warnings via `eslint-plugin-only-warn`
- TypeScript ESLint recommended rules enabled
- Prettier integration via `eslint-config-prettier`
- Turbo `no-undeclared-env-vars` rule enabled
- `dist/**` directories ignored

## Usage

In a consuming package's `eslint.config.js`:

```js
import { config } from "@repo/eslint-config/base";
export default [...config];
```

## Modifying

Edit the config files directly. Changes apply to all consuming packages on next lint run.
