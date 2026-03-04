---
name: plan
description: Create an implementation plan using the Architect subagent
allowed-tools: Read, Write, Glob, Grep, Task
model: sonnet
---

Invoke the Architect subagent to create an implementation plan.

## Process

1. Spawn Architect subagent with the user's request
2. Subagent explores codebase and creates plan
3. Plan is written to `.plans/<branch-name>.md`
4. Return summary to user

## Usage

```
/plan Add user authentication to the API
/plan Fix the bug where prices show as null
/plan Refactor the payment module to use repository pattern
```

## Output

Write or edit the plan at `.plans/<branch-name>.md` with:

- Clear objective statement
- Numbered action items with file paths
- Test requirements
- Risk considerations

## Constraints

- Do not implement - only plan
- Ask clarifying questions if requirements are ambiguous
- Consider security implications
