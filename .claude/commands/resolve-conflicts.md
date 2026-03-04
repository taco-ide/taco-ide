---
name: resolve-conflicts
description: Resolve git merge conflicts with intelligent analysis
allowed-tools: Bash, Read, Edit, Grep, Glob, Skill, Task
model: sonnet
---

# Resolve Conflicts Command

## Purpose

Analyze and resolve git merge conflicts with semantic understanding. Automatically resolves trivial conflicts (formatting, imports), suggests options for moderate conflicts, and explains complex conflicts for user decision.

## Prerequisites

- Active git repository with merge conflicts
- Clean working state before starting
- Optional: PR descriptions or related documentation

## Usage

### Basic Usage
```bash
/resolve-conflicts                    # Analyze all active conflicts
```

### With Options
```bash
/resolve-conflicts --auto-only        # Only resolve trivial conflicts
/resolve-conflicts --check-only       # Analyze without applying changes
/resolve-conflicts src/feature.py     # Resolve specific file
/resolve-conflicts --strategy manual  # Show all options manually
```

## Process

### 1. Conflict Detection
- Run `git status` to identify conflicted files
- Count total conflicts and affected files
- Check if merge is in progress

### 2. Conflict Analysis
- For each conflicted file:
  - Read conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
  - Extract both versions (current and incoming)
  - Read surrounding context (50+ lines)
  - Analyze commit messages and intent

### 3. Conflict Classification
Categorize each conflict:
- **TRIVIAL**: Formatting, imports, whitespace → auto-resolve
- **MODERATE**: Method changes, variable renames → suggest options
- **COMPLEX**: Business logic, data models → explain and ask

### 4. Resolution Presentation
For trivial conflicts:
- Apply resolution automatically
- Show confirmation

For moderate/complex conflicts:
- Present 2-3 resolution strategies
- Show pros/cons of each
- Suggest recommendation
- Request user choice

### 5. Resolution Application
- Apply user-confirmed resolutions
- Generate test cases for non-trivial resolutions
- Verify resolved code is valid

### 6. Completion
- Generate conflict resolution report
- Suggest commit message
- Provide next steps

## Output Format

### Summary Report
```
Conflict Resolution Report
==========================

ANALYZED: 5 conflicted files

AUTO-RESOLVED (3):
✓ src/utils.py (Line 45-52)
  Reason: Import order conflict

✓ tests/test_api.py (Line 23-29)
  Reason: Formatting (line wrapping)

✓ requirements.txt (Line 5-8)
  Reason: Dependency order

NEEDS REVIEW (2):
⚠ src/api.py (Line 89-120)
  Type: MODERATE - Method signature change
  Current: def fetch_user(id: int) -> User
  Incoming: def fetch_user(id: int, cache: bool = True) -> User

  Recommendation: Accept INCOMING (adds optional parameter)
  Affected Callers: 3 call sites - can accept both signatures

⚠ src/models.py (Line 156-189)
  Type: COMPLEX - Data model expansion
  Current: Adds 'email_verified' field
  Incoming: Adds 'last_login' field

  Recommendation: MERGE BOTH
  Rationale: Features are independent, both valuable
```

## Conflict Types Explained

### TRIVIAL Conflicts (Auto-resolved)

**Examples**:
- Different code formatting (black, prettier)
- Import statement reordering (isort)
- Comment-only changes
- Whitespace normalization

**Why Safe**:
- No logic changes
- Tools can verify correctness
- Easy to test

### MODERATE Conflicts (Suggest options)

**Examples**:
- Method signature changes with updates needed
- Variable renames across scope
- Non-breaking API modifications
- Dependency version changes

**Why Needs Review**:
- Must update all usages
- Could break if incomplete
- User should verify intent

### COMPLEX Conflicts (Explain and ask)

**Examples**:
- Business logic conflicts
- Architectural changes
- Data model conflicts
- Core algorithm changes

**Why Escalate**:
- Requires understanding intent
- Multiple valid solutions
- Business decision needed

## Test Case Generation

For MODERATE and COMPLEX resolutions, tests are generated:

```python
# Example test for merged changes
def test_resolution_preserves_current_behavior():
    """Verify current branch behavior is maintained."""
    # Tests current branch requirements
    pass

def test_resolution_preserves_incoming_behavior():
    """Verify incoming branch behavior is maintained."""
    # Tests incoming branch requirements
    pass

def test_resolution_merged_behavior():
    """Verify merged version works correctly."""
    # Tests combined/resolved behavior
    pass
```

## Git Integration

### Before Merge
```bash
git fetch origin
git merge origin/main
# Conflicts occur...
/resolve-conflicts
```

### Recovery Options
If resolution goes wrong:
```bash
/resolve-conflicts --undo       # Abort and restore previous state
git merge --abort               # Cancel merge entirely
```

## Resolution Confirmation

For each resolution, you'll be asked:

```
Apply this resolution?
[Y]es / [S]kip / [V]iew details
```

- **Yes**: Apply this resolution and continue
- **Skip**: Leave this file unresolved and move to next
- **View**: Show detailed analysis before deciding

## Generated Artifacts

### Conflict Resolution Report
- Summary of all resolutions
- Rationale for each decision
- Test cases generated

### Suggested Commit Message
```
merge: resolve conflicts from main

- src/utils.py: Import order (auto-resolved)
- src/api.py: Accept incoming method signature
- src/models.py: Merge both data model fields

Tests: 6 new tests added for merged behavior

Conflicts merged with ConflictResolver agent.
Both branches' improvements preserved where possible.
```

## Best Practices

1. **Review before applying**: Understand each conflict before accepting
2. **Test after resolving**: Run test suite to verify merged behavior
3. **Document complex decisions**: Explain why in commit message
4. **Preserve both intents**: When both branches add value, merge them
5. **Use formatter tools**: For formatting conflicts, use project formatter
6. **Ask for help**: If uncertain, escalate to team

## Known Limitations

- Cannot determine intent without code context
- Large merge conflicts may take time to analyze
- Requires clean git state before merge
- Some conflicts need human judgment

## Next Steps

After resolution:
```bash
git status              # Verify all conflicts resolved
/test                  # Run test suite
/lint                  # Check formatting
/commit                # Create merge commit
```

## Examples

### Example 1: Simple Format Conflict

```bash
/resolve-conflicts

[ConflictResolver analyzes...]

AUTO-RESOLVED (1):
✓ src/main.py (Formatting conflict)

All conflicts resolved automatically!
Next: /test to verify, /commit to finalize
```

### Example 2: Complex Logic Conflict

```bash
/resolve-conflicts

NEEDS REVIEW (1):
⚠ src/pricing.py - COMPLEX Conflict
  Current (main): Customer-based discount tiers
  Incoming (feature): Amount-based discount tiers

  I cannot determine which approach is correct without
  understanding the business requirement.

Questions for you:
1. Should discount be based on customer type or order amount?
2. Or should both factors apply?

Please advise, then I can suggest a resolution.
```

---

## Troubleshooting

### "No conflicts found"
- Merge is already complete
- Try `git status` to verify

### "Unable to auto-resolve"
- Conflict is complex and needs manual review
- Follow the suggested options

### "Test failures after resolution"
- Generated tests don't pass
- Review the resolution logic
- Consider different strategy

### "Merge conflicts reappear"
- Cherry-pick or rebase may re-introduce
- Use `/resolve-conflicts` again
- If persistent, consider rebasing onto the target branch instead
