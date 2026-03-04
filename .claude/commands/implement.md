---
name: implement
description: Implement the plan using the Developer subagent
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: haiku
---

Invoke the Developer subagent to implement the current plan.

## Process

1. Read the current plan from `.plans/<branch-name>.md`
2. Spawn Developer subagent with the plan
3. Subagent implements code and tests
4. Updates plan with completed items
5. Return summary to user

## Prerequisites

- A plan must exist (run /plan first)
- Plan should have uncompleted items

## Usage

```
/implement           # Implement all remaining items
/implement step 3    # Implement specific step
```

## Output

- Files modified
- Tests written
- Updated plan status

## Constraints

- Follow the plan exactly
- Write tests for all new code
- Keep changes minimal and focused
