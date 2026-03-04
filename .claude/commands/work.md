---
name: work
description: Smart workflow orchestrator - resumes from current state and guides through the development loop
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
model: sonnet
---

# Work Command - Smart Development Loop Orchestrator

Execute the complete development workflow with intelligent state detection and user confirmations at key decision points.

## Process

### 1. Detect Current State

Check for existing plan at `.plans/<branch-name>.md`:

**If NO plan exists:**
- Ask user to describe the task
- Run `/plan` to create implementation plan
- Show plan summary and ask for confirmation to proceed

**If plan EXISTS:**
- Read the plan file
- Analyze completion status (check for `[x]` vs `[ ]` items)
- Show plan summary with progress
- Ask user to confirm before proceeding to implementation

### 2. Execute Development Loop

Once plan is confirmed, execute sequentially:

```
Implement → Test → Lint → Review → [Decision Point]
```

**Implementation Phase:**
- Run `/implement` to execute uncompleted plan items
- Developer subagent marks tasks as complete

**Verification Phase:**
- Run `/test` to execute test suite
- Run `/lint` to check code quality
- If failures occur, report them and ask to fix before proceeding

**Review Phase:**
- Run `/review` to get Reviewer feedback
- Present review results to user

### 3. Decision Point (After Review)

Ask user what to do next:

**Options:**
- **Iterate**: Issues found? Go back to `/plan` or `/implement` to fix
- **Commit**: Everything approved? Run `/commit` to save changes
- **New Plan**: Start fresh with `/plan` for a new task
- **Stop**: End the workflow

## State Detection Logic

```
Check .plans/<branch>.md exists?
  ├─ NO  → Ask for task → /plan → Confirm → Continue
  └─ YES → Show progress → Confirm → Continue
             ↓
Check plan has incomplete items?
  ├─ NO  → Ask: start new plan or review existing?
  └─ YES → /implement
             ↓
           /test → /lint
             ↓
           /review
             ↓
    Decision: iterate | commit | new plan | stop
```

## Usage Examples

```bash
# Starting fresh (no plan)
/work
# Claude: "No plan found. What would you like to work on?"
# User: "Add user authentication to the API"
# Claude runs /plan, shows summary, asks to proceed

# Resuming work (plan exists with incomplete items)
/work
# Claude: "Found plan: 'Add user authentication' (3/5 tasks complete)"
# Claude: Shows remaining tasks, asks to proceed
# Claude runs /implement → /test → /lint → /review

# After review
# Claude: "Review complete. Next steps: [Iterate|Commit|New Plan|Stop]?"
```

## Confirmation Points

The workflow asks for user confirmation at:

1. **Before starting** - After showing plan summary
2. **After test/lint failures** - Before proceeding to review
3. **After review** - What to do next (iterate/commit/new/stop)

## Output Format

At each phase, provide clear status updates:

```
📋 Current Plan: [title]
✅ Completed: [X] tasks
⏳ Remaining: [Y] tasks

🔨 Running /implement...
✅ Implementation complete

🧪 Running /test...
✅ Tests passed (or ❌ with details)

🔍 Running /lint...
✅ Linting passed (or ⚠️ with warnings)

👁️ Running /review...
[Review results]

❓ What would you like to do next?
```

## Error Handling

- If `/test` fails: Report errors, ask to fix and re-run
- If `/lint` fails: Show issues, ask to fix and re-run
- If `/review` requests changes: Ask to iterate back to /plan or /implement
- If plan file is corrupted: Offer to create new plan

## Constraints

- ALWAYS show plan summary before executing
- ALWAYS ask for confirmation at decision points
- NEVER proceed if tests fail without user acknowledgment
- KEEP user informed at each phase transition
