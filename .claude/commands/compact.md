---
name: compact
description: Summarize and compress the conversation context
allowed-tools: none
model: sonnet
---

Summarize the current conversation to reduce context size.

## Process

1. Identify key decisions made
2. Note completed tasks
3. Capture any learnings or insights
4. List remaining work items

## Usage

```
/compact "Completed auth implementation, tests passing"
```

## Output

Provide a concise summary that preserves:

- What was accomplished
- Current state of the work
- Next steps

The summary should enable continuing the work without the full history.
