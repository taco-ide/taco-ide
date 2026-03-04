---
name: refine-skill
description: Refine and improve an existing skill based on usage patterns
allowed-tools: Read, Write, Edit, Grep, Bash
model: sonnet
---

# Skill Refinement Command

Improve an existing skill by analyzing usage and adding missing content.

## Usage

```
/refine-skill <skill-name> [focus-area]
```

Examples:
- `/refine-skill coding-standards`
- `/refine-skill testing unit-tests`
- `/refine-skill architecture patterns`

## Process

1. **Read Current Skill**
   - Load `~/.claude/skills/<skill-name>/SKILL.md`
   - List all context files
   - Understand current structure

2. **Analyze Usage**
   - Search operations.log for skill references
   - Identify which context files are accessed most
   - Note which subagents use this skill

3. **Identify Gaps**
   Ask user:
   - What content is missing from this skill?
   - What questions come up repeatedly?
   - What context would have been helpful?
   - Are there repeated patterns that should be documented?

4. **Refine Content**
   Based on feedback:
   - Add missing context files
   - Update existing documentation
   - Improve SKILL.md structure
   - Add examples or templates

5. **Document Changes**
   Update skill's SKILL.md with:
   - Changelog entry
   - New capabilities added
   - Usage guidance updates

## Output Format

```markdown
# Skill Refinement: [skill-name]
Date: [YYYY-MM-DD]

## Current State
- Context files: [list]
- Usage count: X times this week
- Primary users: [subagent list]

## Gaps Identified
- [Gap 1]
- [Gap 2]

## Changes Made
- [Change 1]
- [Change 2]

## Updated Structure
[Show new directory structure]

## Next Refinements
- [ ] [Future improvement 1]
- [ ] [Future improvement 2]
```

## Constraints
- Never remove existing content without asking
- Keep skill focused - don't let it grow too broad
- Maintain clear separation from other skills
- Update SKILL.md metadata if capabilities change
