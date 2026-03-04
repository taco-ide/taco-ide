---
name: lint
description: Run linting and formatting checks
allowed-tools: Bash
model: haiku
---

Run the project's linting and formatting tools.

## Process

1. Detect project type (package.json, pyproject.toml, etc.)
2. Run appropriate linting command:
   - Python: `make lint` or `ruff check .`
   - JavaScript/TypeScript: `npm run lint`
   - Go: `golangci-lint run`
3. Report results clearly

## Usage

```
/lint                # Run all linters
/lint --fix          # Auto-fix where possible
```

## Output

- List of issues found
- Suggested fixes
- Commands to auto-fix if available
