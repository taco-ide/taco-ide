---
name: test
description: Run the project test suite
allowed-tools: Bash
model: haiku
---

Run the project's test suite and report results.

## Process

1. Check if test infrastructure exists (look for vitest.config.ts or test scripts in package.json)
2. If tests exist, run the appropriate test command
3. Parse and format results
4. Report summary

## Usage

```
/test                # Run all tests
/test unit           # Run unit tests only
/test --coverage     # Run with coverage report
```

## Project-Specific Commands

- From root: `npm run test` (if configured in turbo.json)
- API only: `cd apps/api && npm run test`
- Web only: `cd apps/web && npm run test`

## Note

If no test infrastructure exists yet, report this and suggest setting up Vitest.

## Output

- Test summary (pass/fail counts)
- Failed test details
- Coverage report if available
