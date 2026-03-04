---
name: review
description: Review code changes using the Reviewer subagent
allowed-tools: Read, Grep, Bash, Task
model: sonnet
---

Invoke the Reviewer subagent to review all uncommitted changes.

## Process

1. Get git diff of current changes (`git diff main...HEAD`)
2. Read the original plan from `.plans/<branch-name>.md` if it exists
3. Spawn Reviewer subagent with full diff + plan context
4. Subagent performs thorough review **including cross audit**
5. Return review report

## Usage

```
/review              # Review all changes (includes cross audit)
/review --security   # Focus on security issues
```

## Output Format

Review report with:

- 🔴 Critical issues (must fix)
- 🟡 Suggestions (should consider)
- 🟢 Positive observations
- 🔍 Cross audit findings (cross-file impact, cross-layer consistency, cross-concern validation)
- Final verdict: APPROVE / REQUEST CHANGES

## Focus Areas

- OWASP top 10 vulnerabilities
- Input validation
- Error handling
- Test coverage
- Code style

## Cross Audit (mandatory)

The reviewer MUST perform a cross audit on every review:

1. **Cross-file impact**: Use Grep/Glob to find all callers and dependents of changed symbols. Flag any file that imports or references a changed function, class, constant, or DB column but was NOT updated.
2. **Cross-layer consistency**: For each changed entity, verify the change propagates correctly through domain → DB model → repository → API schema → tests. Report any layer where the change is missing or inconsistent.
3. **Cross-concern validation**: For each change, evaluate correctness, security, performance (N+1 queries, missing indexes), and test coverage simultaneously. Do not evaluate these in isolation.
