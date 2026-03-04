---
name: update-deps
description: Update project dependencies with changelog analysis and testing
allowed-tools: Bash, Read, Edit, Grep, Glob, WebFetch, WebSearch, Skill, Task
model: sonnet
---

# Update Dependencies Command

## Purpose

Update project dependencies with comprehensive changelog analysis, breaking change detection, test validation, and migration guide generation. Supports multiple update strategies and ecosystems.

## Prerequisites

- Project with dependency files (requirements.txt, package.json, Cargo.toml, etc.)
- Test suite available for validation
- Clean working directory

## Usage

### Basic Usage
```bash
/update-deps                          # Interactive, moderate strategy
```

### With Update Strategy
```bash
/update-deps --strategy conservative  # Patch updates only (1.2.3 → 1.2.4)
/update-deps --strategy moderate      # Minor updates (1.2.3 → 1.3.0)
/update-deps --strategy aggressive    # Major updates (1.2.3 → 2.0.0)
/update-deps --security-only          # Security vulnerabilities only
```

### Check Without Updating
```bash
/update-deps --check-only             # Report updates without applying
```

### Specific Package
```bash
/update-deps django                   # Update specific package
/update-deps --only security          # Only security-critical updates
```

## Process

### Phase 1: Detection (2-3 minutes)
1. **Detect Ecosystem**
   - Find dependency files (requirements.txt, package.json, Cargo.toml, poetry.lock, etc.)
   - Identify package manager (pip, npm, cargo, poetry, pipenv)
   - Determine current versions

2. **Query Available Updates**
   - Check for available versions
   - Detect security vulnerabilities
   - Identify unused dependencies

3. **Analyze Dependencies**
   - Group by ecosystem
   - Calculate current state
   - Determine update scope

**Output**:
```
Detected Ecosystems
===================
✓ Python (pip)
  - requirements.txt: 24 packages
  - Current Python: 3.11

✓ Node.js (npm)
  - package.json: 42 packages
  - lock file: package-lock.json
```

### Phase 2: Planning (5-10 minutes)
1. **Create Update Plan**
   - Identify available updates per strategy
   - Assess breaking changes from changelogs
   - Group updates by risk level
   - Estimate testing time

2. **Risk Assessment**
   - CRITICAL: Breaking changes or major version
   - HIGH: Minor version or security
   - MEDIUM: Patch version with changes
   - LOW: Patch version, no issues

3. **Present Plan to User**
   - Show packages to update
   - Highlight critical vulnerabilities
   - List breaking changes
   - Request confirmation

**Example Plan**:
```
Update Plan (Moderate Strategy)
================================

CRITICAL SECURITY (Update immediately)
✓ requests 2.25.1 → 2.31.1
  Severity: HIGH (CVE-2023-32681)
  Risk: Low (patch compatible)

BREAKING CHANGES (Needs migration)
⚠ django 4.1 → 4.2
  Breaking: Config changes
  Migration: 1 file affected

ROUTINE UPDATES (Safe)
✓ pytest 7.3.1 → 7.4.0
✓ black 23.7.0 → 23.10.0

Proceed? [Y]es / [N]o / [D]etails
```

### Phase 3: Update Application (10-30 minutes per batch)
1. **Apply Updates Incrementally**
   - Update one ecosystem at a time
   - Group by risk level (security first)
   - Apply batch of compatible updates
   - Run tests after each batch

2. **Test Validation**
   - Run full test suite
   - Check for deprecation warnings
   - Verify no new errors

3. **Batch Status**
   - Show results of each update
   - Highlight any failures
   - Continue with next batch or rollback

**Example Progress**:
```
Applying Updates
================

Batch 1: Security Updates (Python)
Updating requests 2.25.1 → 2.31.0... ✓
Updating pillow 9.0.0 → 10.2.0... ✓
Running tests... ✓ (156 tests passed)

Batch 2: Minor Updates (Python)
Updating pytest 7.3.1 → 7.4.0... ✓
Updating black 23.7.0 → 23.10.0... ✓
Running tests... ✓ (156 tests passed)

Batch 3: Node.js Updates
Updating lodash 4.17.20 → 4.17.21... ✓
Updating mocha 10.0.0 → 10.2.0... ✓
Running tests... ✓ (89 tests passed)
```

### Phase 4: Migration Guide Generation
1. **Identify Required Code Changes**
   - Scan for deprecated API usage
   - Find code affected by breaking changes
   - Generate specific fixes needed

2. **Create Migration Document**
   - List each file with changes
   - Show before/after code
   - Explain rationale

3. **Apply Automated Fixes**
   - Apply trivial fixes automatically
   - Flag complex changes for manual review

**Example Migration Guide**:
```
Migration Guide: Django 4.1 → 4.2
==================================

1. CSRF_TRUSTED_ORIGINS Format Change
   File: settings.py (Line 87)
   Change: Add https:// to domain names

   Before:
   CSRF_TRUSTED_ORIGINS = ['example.com']

   After:
   CSRF_TRUSTED_ORIGINS = ['https://example.com']

2. Removed django.utils.text.smart_text
   Files: utils.py (Line 45), api.py (Line 23)
   Change: Replace with str() or smart_bytes()

   Before: text = smart_text(value)
   After:  text = str(value)
```

### Phase 5: Completion Report
1. **Summary**
   - Total packages updated
   - Total security fixes
   - Breaking changes handled
   - Tests passing

2. **Artifacts Generated**
   - Updated dependency files
   - Migration guide
   - Test updates
   - Commit message suggestion

3. **Next Steps**
   - Review changes
   - Manual testing if needed
   - Commit and deploy

**Example Completion**:
```
Update Complete!
================

Summary
-------
Python: 8 packages updated
Node.js: 5 packages updated
Security Fixes: 3 (CRITICAL x1, HIGH x2)
Breaking Changes: 1 (Django config)
Tests Passing: 245/245 ✓

Artifacts
---------
✓ requirements.txt updated
✓ package.json updated
✓ Migration guide generated (MIGRATION_4.1_to_4.2.md)
✓ Tests updated (no test failures)

Next Steps
---------
1. Review generated files
2. Manual testing of Django settings
3. Commit: git add requirements.txt package.json && git commit -m "...update-deps..."
4. Deploy
```

## Update Strategies Explained

### Conservative (Patch Updates Only)
```
Current: django 4.1.0, requests 2.31.0
Available: django 4.1.5, requests 2.31.1
Action: Update to patch versions only
Result: More stable, less testing needed
```

**Best for**: Production systems, minimal risk tolerance

### Moderate (Minor + Patch Updates)
```
Current: django 4.1.0, requests 2.31.0
Available: django 4.2.0, requests 2.32.0
Action: Update to latest minor version
Result: Good balance of safety and freshness
```

**Best for**: Active projects with good test coverage

### Aggressive (Major + Minor + Patch Updates)
```
Current: django 4.1.0, requests 2.31.0
Available: django 5.0.0, requests 3.0.0
Action: Update to latest major version
Result: Latest features, more migration effort
```

**Best for**: New projects, planned upgrade cycles

### Security-Only
```
Current: requests 2.25.1 (VULNERABLE - CVE-2023-32681)
Available: requests 2.31.1 (has fix)
Action: Update only to patched version, ignore other updates
Result: Security fix, no feature changes
```

**Best for**: Emergency security patches, production hotfixes

## Ecosystem Support

### Python (pip, poetry, pipenv)
- Detects: requirements.txt, setup.py, pyproject.toml, poetry.lock, Pipfile
- Commands: pip, poetry, pipenv
- Security: pip-audit
- Tests: pytest

### Node.js (npm, yarn, pnpm)
- Detects: package.json, yarn.lock, pnpm-lock.yaml
- Commands: npm, yarn, pnpm
- Security: npm audit, yarn audit
- Tests: npm test, jest

### Rust (cargo)
- Detects: Cargo.toml, Cargo.lock
- Commands: cargo
- Security: cargo audit
- Tests: cargo test

### Others (Java, Go, Ruby, PHP)
- Partially supported through basic commands
- Full support may require additional tools

## Test Validation

After each update batch:

1. **Run test suite**
   ```bash
   pytest              # Python
   npm test            # Node.js
   cargo test          # Rust
   ```

2. **Check for warnings**
   ```bash
   pip-audit           # Python security
   npm audit           # Node.js security
   ```

3. **Manual verification**
   - Application starts without errors
   - Main workflows function correctly
   - Performance acceptable

## Rollback on Failure

If tests fail after update:

1. **Automatic rollback**
   - Revert dependency files
   - Reinstall original versions
   - Verify tests pass again

2. **Analysis**
   - Report which update caused failure
   - Suggest alternatives

3. **Continue**
   - Skip failed package (for now)
   - Continue with remaining updates
   - Or halt and report failure

**Example**:
```
Updating Django 4.1 → 4.2...
Running tests... ✗ FAILED

Rollback: Django 4.1 detected
Reverting to Django 4.1.0...
Reinstalling dependencies...
Running tests... ✓ PASSED

Analysis: Django 4.2 has breaking changes
Solution: Create manual migration guide first

Continuing with other updates...
```

## Generated Files

### Updated Dependency Files
- `requirements.txt` - Updated with new versions
- `package.json` - Updated with new versions
- `Cargo.toml` - Updated with new versions
- Lock files - Regenerated for reproducibility

### Migration Guide
- `MIGRATION_{oldver}_to_{newver}.md` - Step-by-step migration instructions
- Specific file locations affected
- Before/after code examples
- Testing validation steps

### Updated Tests
- New tests for breaking changes
- Compatibility tests
- Regression tests

## Error Handling

### Common Issues

**Issue**: Package version not available
```
Error: requests 2.31.0 not found
Action: Check version number, use latest instead
```

**Issue**: Conflicting dependencies
```
Error: celery 5.3 requires kombu >= 5.3
       But kombu 5.2 is required by another package
Action: Show conflict, ask user to resolve manually
```

**Issue**: Test failure after update
```
Error: 3 tests failed after pytest update
Action: Show failed tests, offer rollback
```

## Best Practices

1. **Update one ecosystem at a time** - Easier to identify issues
2. **Read changelogs** - Understand what changed
3. **Test thoroughly** - Run full test suite
4. **Commit frequently** - Each successful batch
5. **Document changes** - In commit message
6. **Update lock files** - For reproducibility
7. **Monitor in production** - Watch for regressions
8. **Use version ranges** - Instead of exact pins when safe

## Performance Considerations

- **Caching**: Use cached changelog data when possible
- **Parallel**: Check multiple packages in parallel
- **Incremental**: Update in batches, not all at once
- **Timeout**: Allow longer timeout for large repos

## Integration with Workflow

### During Feature Development
```bash
/update-deps --strategy moderate
# Update regularly to stay current
```

### Before Release
```bash
/update-deps --strategy conservative --security-only
# Security patches only, minimal changes
```

### Quarterly Maintenance
```bash
/update-deps --strategy aggressive
# Plan major version updates
```

### Security Incident
```bash
/update-deps --security-only
# Fix only the vulnerable packages
```
