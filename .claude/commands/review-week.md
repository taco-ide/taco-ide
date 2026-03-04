---
name: review-week
description: Weekly PAI retrospective and improvement planning
allowed-tools: Read, Write, Grep, Bash
model: sonnet
---

# Weekly Review Command

Conduct a structured weekly review of PAI usage and effectiveness.

## Process

1. **Analyze Usage Logs**
   - Read `~/.claude/history/operations.log`
   - Count tool usage by type
   - Identify most-used commands
   - Identify most-invoked subagents

2. **Review Session History**
   - Read recent sessions from `~/.claude/history/sessions/`
   - Identify patterns in workflow
   - Note repeated problems

3. **Guided Reflection**
   Ask user:
   - What worked well this week?
   - What caused friction or frustration?
   - What capabilities are missing?
   - What took too long or required too many steps?

4. **Generate Action Items**
   Based on feedback, create specific improvement tasks:
   - Skills to create/update
   - Commands to add/modify
   - Context to optimize
   - Documentation to improve

5. **Create Review Document**
   Write to `~/.claude/history/reviews/YYYY-MM-DD-weekly.md` with:
   - Usage statistics
   - Key insights
   - Action items
   - Success metrics for next week

## Output Format

```markdown
# Weekly PAI Review - [Date]

## Usage Statistics
- Total sessions: X
- Most used commands: [list]
- Most invoked subagents: [list]
- Average token usage: X

## What Worked Well
- [Observation 1]
- [Observation 2]

## Friction Points
- [Issue 1] - Priority: [High/Med/Low]
- [Issue 2] - Priority: [High/Med/Low]

## Missing Capabilities
- [Gap 1]
- [Gap 2]

## Action Items
- [ ] [Action 1] - Impact: [High/Med/Low]
- [ ] [Action 2] - Impact: [High/Med/Low]

## Next Week Goals
- [Goal 1]
- [Goal 2]
```

## Constraints
- Run this every Friday or end of sprint
- Be honest about what's not working
- Prioritize high-impact, low-effort improvements
