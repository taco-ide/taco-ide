#!/bin/bash
# Session start hook - loads context and sets up environment
# Receives JSON on stdin with session info

# Consume stdin
cat > /dev/null

HISTORY_DIR="$HOME/.claude/history/sessions"
mkdir -p "$HISTORY_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session started" >> "$HISTORY_DIR/session-log.txt"
echo "  Working directory: $(pwd)" >> "$HISTORY_DIR/session-log.txt"
echo "  Git branch: $(git branch --show-current 2>/dev/null || echo 'N/A')" >> "$HISTORY_DIR/session-log.txt"
