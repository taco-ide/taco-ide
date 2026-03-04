#!/bin/bash
# Subagent stop hook - runs when a subagent completes
# Receives JSON on stdin

INPUT=$(cat)
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

HISTORY_DIR="$HOME/.claude/history/sessions"
mkdir -p "$HISTORY_DIR"

echo "[$TIMESTAMP] Subagent completed" >> "$HISTORY_DIR/subagent-log.txt"

exit 0
