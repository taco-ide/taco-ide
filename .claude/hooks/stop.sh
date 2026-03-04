#!/bin/bash
# Session stop hook - captures session end
# Receives JSON on stdin

cat > /dev/null

SESSION_LOG="$HOME/.claude/history/sessions/session-log.txt"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

mkdir -p "$HOME/.claude/history/sessions"

echo "[$TIMESTAMP] Session ended" >> "$SESSION_LOG"

exit 0
