---
name: commit
description: Create a git commit with appropriate message
allowed-tools: Bash
model: haiku
---

Stage changes and create a commit with a descriptive message.

## Process

1. Run git status to see changes
2. Run git diff to understand changes
3. Generate commit message following conventions
4. Stage and commit

## Usage

```
/commit              # Commit all changes
/commit --amend      # Amend previous commit
```

## Commit Message Format

```
<type>: <description>

<body>
```

Types: feat, fix, refactor, test, docs, chore

## Constraints

- Follow conventional commits format
- Keep subject line under 50 characters
- Explain "why" in the body
- Never force push to main/master
