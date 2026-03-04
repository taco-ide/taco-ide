#!/bin/bash
# Post-tool-use hook - logging after tool execution
# Receives JSON on stdin: {"tool_name": "...", "tool_input": {...}, "tool_result": "..."}

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Ensure log directories exist
mkdir -p "$HOME/.claude/history"

# Log tool usage
echo "[$TIMESTAMP] $TOOL_NAME executed" >> "$HOME/.claude/history/operations.log"

exit 0
