---
name: optimize
description: Optimize PAI context size and token usage
allowed-tools: Read, Bash, Grep
model: sonnet
---

# Context Optimization Command

Analyze and optimize PAI context to reduce token usage while maintaining effectiveness.

## Process

1. **Measure Current State**
   - Count tokens in main CLAUDE.md
   - Count tokens in each skill's SKILL.md
   - List all subagent definition sizes
   - Calculate total "always-loaded" context

2. **Identify Optimization Targets**
   Check for:
   - Embedded content that should be external
   - Redundant information across files
   - Overly verbose descriptions
   - Content that's rarely accessed

3. **Generate Optimization Report**
   ```markdown
   # Context Optimization Report

   ## Current Token Usage
   - CLAUDE.md: X tokens
   - Skills (total): X tokens
   - Subagents (total): X tokens
   - Commands (total): X tokens
   - **Total Context**: X tokens

   ## Recommendations

   ### High Priority (>20% savings)
   - [Recommendation 1] - Saves X tokens

   ### Medium Priority (5-20% savings)
   - [Recommendation 2] - Saves X tokens

   ### Low Priority (<5% savings)
   - [Recommendation 3] - Saves X tokens
   ```

4. **Ask User to Approve Changes**
   Present recommendations and get approval before modifying files.

5. **Apply Optimizations**
   If approved:
   - Refactor verbose content
   - Move embedded content to external files
   - Create progressive disclosure patterns
   - Update cross-references

6. **Verify Functionality**
   After changes:
   - Test that all commands still work
   - Verify subagents can still reference skills
   - Check that hooks still function

## Optimization Strategies

### Progressive Disclosure
```markdown
# Before (embedded)
## All Patterns
[5000 tokens of pattern documentation]

# After (referenced)
## Patterns
See `context/patterns.md` for:
- Factory Pattern
- Repository Pattern
- Observer Pattern
[Load on demand via subagent]
```

### Deduplication
- Identify content repeated in multiple files
- Create single source of truth
- Add cross-references

### Conciseness
- Remove filler words
- Use bullet points over paragraphs
- Keep examples minimal but clear

## Constraints
- Never sacrifice clarity for brevity
- Always maintain complete functionality
- Back up files before modifying
- Test after changes
