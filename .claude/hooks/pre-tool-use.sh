#!/bin/bash
# Pre-tool-use hook - security validation before tool execution
# Receives JSON on stdin: {"tool_name": "...", "tool_input": {...}}

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Dangerous patterns to block
DANGEROUS_PATTERNS=(
    "rm -rf /"
    "rm -rf ~"
    "sudo rm"
    "chmod .*777"
    "curl.*\|.*bash"
    "wget.*\|.*sh"
    "> /dev/"
    "mkfs"
    "dd if="
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$TOOL_INPUT" | grep -qE "$pattern"; then
        echo "BLOCKED: Dangerous pattern detected: $pattern" >&2
        exit 2
    fi
done

# Log tool usage attempt
mkdir -p "$HOME/.claude/history"
echo "[$(date +"%Y-%m-%d %H:%M:%S")] $TOOL_NAME requested" >> "$HOME/.claude/history/operations.log"

exit 0
