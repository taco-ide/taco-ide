---
name: git-conflict-resolution
description: Best practices for analyzing and resolving git merge conflicts
---

# Git Conflict Resolution Skill

## Overview

This skill contains comprehensive guidance for analyzing and resolving git merge conflicts with semantic understanding. It addresses conflict patterns, resolution strategies, and testing approaches.

Referenced by ConflictResolver subagent when analyzing merges.

## When to Use

**ConflictResolver Agent**: Read this skill before analyzing conflicts to understand:
- Conflict type classification
- Auto-resolution safety criteria
- Strategy selection for different conflict types
- Testing requirements for resolutions

## Contents

### Reference Materials
- `context/conflict-patterns.md` - Common conflict patterns with examples and anti-patterns
- `context/resolution-strategies.md` - Five resolution strategies with pros/cons and testing requirements

## Key Principles

1. **Semantic Understanding** - Read code context, not just text differences
2. **Conservative Resolution** - When in doubt, ask user for clarification
3. **Test Validation** - Create tests for all non-trivial resolutions
4. **Documentation** - Explain reasoning for each decision
5. **User Intent** - Preserve original intent of both branches

## Conflict Categories

- **Trivial**: Formatting, whitespace, import order (safe auto-resolve)
- **Moderate**: Method changes, variable renames (suggest options)
- **Complex**: Business logic, data models (explain and ask user)
