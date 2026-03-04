---
description: Review code using specialized agents (comments|file|staged|branch)
argument-hint: <mode> [file-path]
allowed-tools: Bash(git:*), Bash(gh:*), Task
---

# PR Reviewer

Mode: $1

## Instructions

Review code based on the specified mode:

### Mode: comments
- Use the pr-comment-analyzer agent to fetch and analyze all PR comments
- Then use the code-quality-reviewer agent to address each comment systematically
- Provide a summary of changes made

Current branch: !`git branch --show-current`
PR info: !`gh pr view --json number,title,url`

### Mode: file
- Review the specific file: $2
- Use the code-quality-reviewer agent to analyze code quality, best practices, security issues, and maintainability
- Provide actionable improvement suggestions

### Mode: staged
- Review all currently staged files
- Use the code-quality-reviewer agent for comprehensive review

Staged files:
!`git diff --cached --name-only`

Staged changes:
!`git diff --cached`

### Mode: branch
- Review all modifications in the current branch compared to main
- Use the code-quality-reviewer agent to ensure changes follow best practices

Current branch: !`git branch --show-current`

Modified files:
!`git diff main...HEAD --name-only`

Branch changes summary:
!`git diff main...HEAD --stat`

## Task

Based on the mode "$1" above, execute the appropriate review workflow using the specialized agents.

For all modes:
1. First gather the necessary context (files, changes, or comments)
2. Use the appropriate agent (pr-comment-analyzer and/or code-quality-reviewer)
3. Provide a clear summary of findings and any changes made
4. Follow the project's simplicity principle - minimal, focused changes only
