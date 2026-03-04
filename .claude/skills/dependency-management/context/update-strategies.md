# Dependency Update Strategies

## Semantic Versioning (SemVer)

Semantic versioning follows `MAJOR.MINOR.PATCH` format:

- **MAJOR** (1.0.0 → 2.0.0): Breaking API changes, incompatible updates
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, no new features

**Version Range Notation**:
```
1.2.3      - Exact version only
^1.2.3     - Compatible with 1.2.3 (allows 1.x.x, not 2.0.0)
~1.2.3     - Allows patch updates (1.2.x only)
>=1.2.3    - Any version 1.2.3 or higher
>=1.2.3,<2 - Within range (1.2.3 through 1.x.x)
```

**Best Practice**: Use version ranges (^, ~) instead of exact pins when possible

---

## Strategy 1: Conservative Updates (Patch Only)

### Definition
Update only patch versions (1.2.3 → 1.2.4). No new features, only bug fixes.

### When to Use
- Production systems requiring stability
- Long-term support branches
- Systems with minimal test coverage
- Risk-averse organizations
- Microservices with strict SLAs

### Procedure
1. Identify all available patch updates
2. Filter out minor and major versions
3. Apply patches incrementally
4. Run tests after each patch
5. Review release notes for any warnings

### Example
```
Current:    pytest 7.4.0, black 23.7.0, requests 2.31.0
Available:  pytest 7.4.2, black 23.7.3, requests 2.31.1
Action:     Apply only patch updates
Result:     pytest 7.4.2, black 23.7.3, requests 2.31.1
```

### Testing Requirements
- Run full test suite
- Check for deprecation warnings
- Verify no behavioral changes

### Pros
- Very safe, minimal risk
- No breaking changes expected
- Fast to apply and test
- Easy to troubleshoot if issues occur

### Cons
- Missing important bug fixes from minor/major versions
- May accumulate technical debt
- Security fixes only if in patch version
- New features available elsewhere

### Decision Criteria
```
Use if:
- System is in production
- Team risk tolerance is low
- Downtime is expensive
- Limited testing resources
```

---

## Strategy 2: Moderate Updates (Minor Updates)

### Definition
Update to latest minor version (1.2.3 → 1.3.0). New features allowed, but no breaking changes.

### When to Use
- Active development branches
- Systems with good test coverage
- Regular release cycles
- Features from upstream are needed
- Default strategy for most projects

### Procedure
1. Identify available minor/patch updates (no major)
2. Group updates by dependency
3. Apply updates per ecosystem (all npm, all pip, etc.)
4. Run tests after each batch
5. Review changelog for new features/deprecations

### Example
```
Current:    Django 4.1.0, DRF 3.14.0, Celery 5.2.0
Available:  Django 4.2.10, DRF 3.14.5, Celery 5.3.4
Minor updates: Django 4.2.x, Celery 5.3.x
Action:     Apply minor and patch updates
Result:     Django 4.2.10, DRF 3.14.5, Celery 5.3.4
```

### Changelog Analysis
For each minor version update:
1. Read release notes
2. Check for deprecation warnings
3. Note new features
4. Look for required configuration changes

Example changelog checklist:
```
[ ] Review major features
[ ] Check for deprecations
[ ] Note API changes (even if backwards compatible)
[ ] Look for config changes
[ ] Check requirements for other dependencies
[ ] Verify Python/Node version requirements
```

### Testing Requirements
- Run full test suite
- Check for deprecation warnings
- Test new features if used
- Manual testing of modified features

### Pros
- Good balance of safety and freshness
- Most breaking changes expected in major versions
- Regular access to important bug fixes
- New features available
- Recommended by most projects

### Cons
- More work than conservative strategy
- May need deprecation fixes
- Some breaking changes possible (if SemVer not followed)
- Slightly more testing required

### Decision Criteria
```
Use if:
- Active development
- Good test coverage exists
- Regular release cycles
- Team can handle occasional breaking changes
```

---

## Strategy 3: Aggressive Updates (Major Updates)

### Definition
Update to latest version including major releases (1.2.3 → 2.0.0). May include breaking changes.

### When to Use
- New project development
- Intentional upgrade cycles (quarterly, biannual)
- Need for latest features/architecture
- Keeping up with ecosystem trends
- Refactoring opportunities

### Procedure
1. Identify all available updates (major, minor, patch)
2. **Read full changelogs** for major versions
3. Document breaking changes
4. Create migration guide
5. Update code for breaking changes
6. Apply updates per ecosystem
7. Run comprehensive tests
8. Manual testing and verification

### Example
```
Current:    React 17.0, Vue 2.x, Angular 12
Available:  React 18.x, Vue 3.x, Angular 17
Breaking Changes: Significant API changes in all
Action:     Plan migration, update dependencies, refactor code
Result:     React 18.x, Vue 3.x, Angular 17 (major refactoring)
Timeline:   1-2 weeks per framework
```

### Breaking Change Detection

#### From Changelog
1. Look for "BREAKING CHANGES" section
2. Read "Migration Guide" section
3. Check "Upgrade from X to Y" guide
4. Note all removed/changed APIs

Example:
```markdown
# Breaking Changes in Django 4.0
- Removed django.db.models.Model.ipv6address (use GenericIPAddressField)
- Removed forms.ModelChoiceField.empty_label (use form_kwargs)
- Changed JsonResponse default to compact output
- Removed django.utils.text.smart_text (use str() or smart_bytes)
```

#### Testing Approach
```python
# Before Update Test
def test_django_3_behavior():
    """Verify current Django 3 behavior."""
    response = JsonResponse({'key': 'value'})
    assert 'key' in response.content.decode()

# After Update Test
def test_django_4_behavior():
    """Verify Django 4 compact output behavior."""
    response = JsonResponse({'key': 'value'})
    # Django 4 has compact output by default
    expected = b'{"key": "value"}'  # No extra spaces
    assert response.content == expected
```

### Migration Guide Creation

Document all changes needed:
```markdown
# Django 3 → 4 Migration Guide

## 1. IPv6 Address Field
**File**: models.py (line 45)
**Change**: Remove ipv6address, use GenericIPAddressField
**Before**:
```python
ipv6 = models.IPv6AddressField()
```
**After**:
```python
ipv6 = models.GenericIPAddressField(protocol='IPv6')
```
**Testing**: test_user_ipv6_field()

## 2. JSON Response Output
**File**: api.py (line 120)
**Impact**: JSON responses now compact by default
**Before**: {"key": "value"}  # Pretty printed
**After**: {"key":"value"}     # Compact
**Action**: Update API tests to expect compact format
```

### Testing Requirements
- **Unit tests**: Must pass with new API
- **Integration tests**: End-to-end flows work
- **Manual testing**: UI/UX flows verified
- **Regression tests**: Old behavior tested
- **Performance tests**: Check for regressions

### Pros
- Latest features and improvements
- Modern API and patterns
- Best security patches
- Most optimized performance
- Keeps up with ecosystem

### Cons
- Significant effort to migrate
- Breaking changes require code updates
- Risk of introducing bugs during migration
- May break dependencies on old APIs
- Steep learning curve for major changes

### Decision Criteria
```
Use if:
- Planned upgrade cycle (don't do ad-hoc)
- Team has capacity for refactoring
- Benefits from new features justify cost
- Breaking changes are understood
- Full test suite exists
```

### Timeline Estimate
```
Small project (< 10k LOC): 2-5 days per major version
Medium project (10-100k LOC): 1-2 weeks per major version
Large project (100k+ LOC): 2-4 weeks per major version
```

---

## Strategy 4: Security-Only Updates

### Definition
Update only packages with security vulnerabilities. Ignore feature/minor updates.

### When to Use
- Production hotfix mode
- Security incident response
- Minimal change requirements
- Urgent vulnerability patches

### Procedure
1. Run security scanner (pip-audit, npm audit, cargo audit)
2. Filter for vulnerabilities only (ignore outdated)
3. Check if update exists with CVE fix
4. Apply only vulnerability patches
5. Run tests
6. Commit with security focus

### Example
```
Security Scan Results:
CRITICAL: requests 2.25.1 - CVE-2023-32681
HIGH: pillow 9.0.0 - CVE-2023-50447

Action: Update only these packages
Result: requests 2.31.0, pillow 10.2.0
(Ignore other available updates)
```

### Testing Requirements
- Run full test suite (security patches modify critical code paths — regressions here are worse than the original vulnerability)
- Verify vulnerability is fixed
- Smoke test key workflows
- Do not skip comprehensive testing for security patches

### Pros
- Minimal changes, low risk
- Focused on security only
- Fast to apply and test
- Easy to review

### Cons
- Leaves other updates pending
- May create "update debt"
- Technical debt accumulates
- Can't be used long-term

### Decision Criteria
```
Use if:
- Emergency security response needed
- Production system with CVE
- Can't afford downtime for major testing
```

---

## Strategy Selection Decision Tree

```
What is your risk tolerance?

VERY LOW (Stability critical)
└─ Use: CONSERVATIVE (patch only)
   Cycle: Monthly check for security
   Best for: Production systems, SaaS, banking

LOW (Stability important)
└─ Use: MODERATE (minor updates)
   Cycle: Monthly or quarterly updates
   Best for: Active projects, good test coverage

MEDIUM (Steady progress)
└─ Use: MODERATE with regular MAJOR cycles
   Cycle: Monthly minor, quarterly major
   Best for: Typical projects with team

HIGH (Latest features)
└─ Use: AGGRESSIVE (major updates regularly)
   Cycle: Continuous updates, weekly cycles
   Best for: New projects, startup pace

CRITICAL (Security incident)
└─ Use: SECURITY-ONLY immediately
   Then: Return to normal strategy
```

---

## Changelog Analysis Techniques

### Finding Release Notes
1. GitHub Releases page: `https://github.com/owner/repo/releases`
2. Official documentation: Usually `/docs/changelog` or `/CHANGELOG.md`
3. Package repository: PyPI changelog, npm registry
4. Official blog: Framework blogs often announce major releases

### Reading Changelogs Effectively

**Structure to look for**:
```
# Version X.Y.Z

## Breaking Changes
- List of backwards-incompatible changes

## Deprecations
- Features to remove in future versions

## New Features
- Major new functionality

## Bug Fixes
- Important bug fixes

## Migration Guide
- How to upgrade from previous version
```

**Red flags** to watch for:
- "BREAKING:" prefix
- "Migration required"
- "Deprecated in X, removed in Y"
- "API changed"
- "Config update needed"

### Tools for Changelog Comparison

**Python**:
```bash
pip index versions package_name  # See all versions
pip show package_name            # Current version
```

**Node.js**:
```bash
npm view package_name versions   # See all versions
npm view package_name@latest     # Latest version
npm show package_name changelog  # Changelog (if available)
```

**Rust**:
```bash
cargo search package_name        # See versions
cargo outdated                   # Show outdated packages
```

---

## Testing Strategy for Updates

### Test Pyramid for Dependency Updates

```
        Manual Testing (exploratory)
      ↑
      |  Integration Tests (full workflows)
      |
      |  Unit Tests (individual functions)
      |
    Regression Tests (old behavior still works)
```

### Example Test Plan

**For PATCH update** (low risk):
- Run existing unit tests
- Check for deprecation warnings
- Spot check main workflows

**For MINOR update** (medium risk):
- Run all unit tests
- Run integration tests
- Test new features if used
- Check configuration changes
- Manual testing of modified areas

**For MAJOR update** (high risk):
- Run all tests multiple times
- Integration testing with other systems
- Performance testing
- Security testing
- Manual comprehensive testing
- Staged rollout in production

### Rollback Procedures

**Fast rollback**:
```bash
# If version control with lock files
git checkout HEAD -- requirements.txt package-lock.json
pip install -r requirements.txt
# OR
npm ci

# If not in version control
# Restore from backup or manually edit

# Verify rollback
pip show package_name
npm list package_name
```

**Gradual rollback**:
- Fix code changes that break with old API
- Update to intermediate version
- Test again
- Decide whether to continue or stay on intermediate version

---

## Dependency Update Checklist

- [ ] Read changelog for target version
- [ ] Identify breaking changes
- [ ] Create migration plan if needed
- [ ] Test with development environment
- [ ] Run full test suite
- [ ] Check for deprecation warnings
- [ ] Review dependencies of the updated package
- [ ] Performance test if critical package
- [ ] Document any code changes required
- [ ] Update lock files
- [ ] Commit with clear message
- [ ] Monitor in production
- [ ] Update documentation if needed

---

## Common Pitfalls to Avoid

1. **Updating too many at once**
   - Problem: Can't identify which caused breakage
   - Solution: Update one or few at a time, test each

2. **Ignoring breaking changes**
   - Problem: Code breaks in production
   - Solution: Read changelogs, create migration guide

3. **Not testing properly**
   - Problem: Discover issues after deployment
   - Solution: Run full test suite before committing

4. **Forgetting transitive dependencies**
   - Problem: Dependency's dependency breaks
   - Solution: Review dependency tree after update

5. **Not documenting changes**
   - Problem: Future maintainers confused
   - Solution: Document why update was needed and changes made

6. **Updating security libraries last**
   - Problem: System vulnerable while other updates delayed
   - Solution: Prioritize security updates separately
