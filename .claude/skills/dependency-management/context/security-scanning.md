# Security Scanning for Dependencies

## CVE Basics

### What is a CVE?

A **Common Vulnerabilities and Exposures (CVE)** identifier describes a specific security vulnerability in software.

**Format**: CVE-YYYY-NNNNN
- Example: CVE-2023-32681 (vulnerability discovered in 2023)
- Each CVE is unique and tracked globally
- Published in National Vulnerability Database (NVD)

### Why CVEs Matter

- Allow teams to identify vulnerable dependencies
- Provide common language across security community
- Enable automated scanning and alerts
- Link to patches and workarounds
- Critical for compliance (GDPR, HIPAA, PCI-DSS, etc.)

---

## CVE Information Sources

### Official Databases

#### National Vulnerability Database (NVD)
- **URL**: https://nvd.nist.gov/
- **Coverage**: All public CVEs
- **Data**: Severity scores, impact analysis
- **Limitation**: May lag behind initial disclosure

#### GitHub Security Advisories
- **URL**: https://github.com/advisories
- **Coverage**: Package-specific advisories
- **Data**: Detailed remediation, affected versions
- **Update Frequency**: Near real-time

#### Package Registry Advisories
- PyPI security advisories
- npm security advisories
- RubyGems security advisories
- Package manager specific

### Vulnerability Databases

#### Snyk Vulnerability Database
- **URL**: https://snyk.io/vuln/
- **Coverage**: Multiple ecosystems
- **Data**: Priority scoring, fix availability
- **Commercial**: Free tier available

#### Rapid7 Vulnerability Database
- **URL**: https://www.rapid7.com/db/
- **Coverage**: Various security databases
- **Data**: Risk analysis

---

## Severity Classification

### CVSS Scoring System

Common Vulnerability Scoring System (CVSS) provides numerical severity:

**CVSS v3.1 Severity Ratings**:
```
0.0          | None (no vulnerability)
0.1 - 3.9    | Low
4.0 - 6.9    | Medium
7.0 - 8.9    | High
9.0 - 10.0   | Critical
```

### Practical Severity Levels

#### CRITICAL (CVSS 9.0-10.0)
**What**: Remote code execution, complete system compromise
**Examples**: Unpatched RCE in web framework, SQL injection in ORM
**Action**: Update IMMEDIATELY (even in production)
**Timeline**: Within hours
**CVE Example**: CVE-2021-44228 (Log4j RCE)

```
Vulnerability: Unauthenticated remote code execution
Package: log4j (2.0-beta9 to 2.15.0)
Fix: Update to 2.16.0 or later
Risk: Attacker can execute arbitrary code on server
```

#### HIGH (CVSS 7.0-8.9)
**What**: Significant system impact, likely exploitable, widespread attacks
**Examples**: Authentication bypass, privilege escalation, sensitive data exposure
**Action**: Update within 1-2 weeks
**Timeline**: Next security update cycle
**CVE Example**: CVE-2023-32681 (Requests vulnerability)

```
Vulnerability: HTTP request validation bypass
Package: requests 2.25.1 to 2.31.0
Fix: Update to 2.31.1 or later
Risk: Attacker can bypass security checks
```

#### MEDIUM (CVSS 4.0-6.9)
**What**: Moderate system impact, exploitation may be limited
**Examples**: Denial of service, information disclosure, local privilege escalation
**Action**: Update within 1-2 months
**Timeline**: Next quarterly update cycle
**CVE Example**: CVE-2023-50447 (Pillow vulnerability)

```
Vulnerability: Out-of-bounds read in image processing
Package: pillow 9.0.0-10.2.0
Fix: Update to 10.3.0 or later
Risk: Image processing can crash application
```

#### LOW (CVSS 0.1-3.9)
**What**: Minor impact, likely requires specific conditions
**Examples**: Information disclosure with limited scope, low-impact DoS
**Action**: Update in next planned update cycle
**Timeline**: No urgency
**CVE Example**: CVE-2020-28468 (Minor dependency issue)

```
Vulnerability: Non-critical information disclosure
Package: some-lib 1.0.0-1.2.0
Fix: Update to 1.2.1 or later
Risk: May expose non-sensitive internal details
```

---

## Vulnerability Assessment Workflow

### Step 1: Scan for Vulnerabilities

#### Python
```bash
# Using pip-audit (recommended)
pip-audit

# Output:
# Name            Version  ID              Fix Available
# --------------- -------- --------------- ---------------
# requests        2.28.1   PVE-2023-52857  2.31.0
# pillow          9.0.0    PVE-2023-50447  10.3.0

# Using safety (legacy)
safety check
```

#### Node.js
```bash
# Using npm audit
npm audit

# Output:
# 6 vulnerabilities (3 moderate, 2 high, 1 critical)
# Run `npm audit fix` to fix 4 of them.

# Using yarn audit
yarn audit

# Using pnpm audit
pnpm audit
```

#### Rust
```bash
# Using cargo audit
cargo audit

# Output:
# Vulnerability Report
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Crate: rusqlite
# Version: 0.25.0
# ...
```

### Step 2: Research Each Vulnerability

For each reported vulnerability:

1. **Get CVE ID** and search for details
2. **Read CVE description** - Understand what's vulnerable
3. **Check affected versions** - Verify your version is affected
4. **Look for fix** - Identify patched version
5. **Review changelog** - Understand what changed
6. **Assess impact** - Does this affect your usage?

Example research:
```
Vulnerability: PVE-2023-32681
CVE: CVE-2023-32681
Package: requests 2.25.1 through 2.31.0
Title: HTTP request validation bypass
CVSS: 7.5 (HIGH)

Description:
The requests library may not properly validate some
SSL certificate scenarios, allowing man-in-the-middle
attacks.

Affected Code:
HTTP client applications using requests for sensitive
communications over HTTPS.

Patch:
Update to requests 2.31.1 or later

Not Affected:
- requests < 2.25.1
- requests > 2.31.0

Workaround:
None. Must update.
```

### Step 3: Prioritize by Severity and Impact

**Prioritization Matrix**:

```
             Does it affect?
             No      | Yes
Severity     --------|--------
CRITICAL     Medium  | URGENT
HIGH         Low     | ASAP
MEDIUM       Skip    | Routine
LOW          Skip    | Skip
```

Example:
```
CRITICAL: Remote RCE in log4j
Affects: Yes (we use log4j)
Priority: EMERGENCY - Update today

HIGH: Requests validation bypass
Affects: Partially (we use requests, but only internal APIs)
Priority: UPDATE SOON - This week

MEDIUM: Pillow image processing
Affects: No (we don't process user images)
Priority: UPDATE - Next scheduled cycle
```

### Step 4: Decide: Patch vs Workaround

#### Patch (Update)
**Pros**:
- Fixes root cause
- Get latest security fixes
- Future updates safer
- Recommended approach

**Cons**:
- May introduce breaking changes
- Testing required
- Time investment

**When**: Most of the time

#### Workaround (Mitigate)
**Pros**:
- No code changes
- Can defer major updates
- Quick fix

**Cons**:
- Still vulnerable
- Workaround may break
- Technical debt

**When**: Only if patch incompatible and workaround available

### Example Decision

```
Vulnerability: CVE-2023-32681 (Requests)
Severity: HIGH
Affected: Yes

Available Fix: requests 2.31.1
Breaking Changes: None (patch release)
Our Tests: 200+ tests covering requests usage
Timeline: 2 hours

Decision: PATCH immediately
Action: pip install --upgrade requests==2.31.1
Verification: Run full test suite
```

---

## Scanning Tools & Commands

### Python Ecosystem

#### pip-audit (Recommended)
```bash
# Install
pip install pip-audit

# Scan current environment
pip-audit

# Scan requirements file
pip-audit --desc --requirements requirements.txt

# Fix vulnerable packages automatically
pip-audit --fix

# Output format
# ┌─────────────────────────────────────────┐
# │ advisory | id    | fix available        │
# ├─────────────────────────────────────────┤
# │ CRITICAL │ 52857 │ update to 2.31.1    │
# │ HIGH    │ 50447 │ update to 10.3.0    │
# └─────────────────────────────────────────┘
```

#### Safety
```bash
# Install
pip install safety

# Scan
safety check --json

# Output: JSON with vulnerabilities
```

### JavaScript/Node.js Ecosystem

#### npm audit
```bash
# Scan
npm audit

# With detailed output
npm audit --json | jq '.metadata'

# Auto-fix where possible
npm audit fix

# Output:
# npm warn risky-audit npm audit fix
# npm notice New major version of npm available: ...
# npm WARN lifecycle npm-publish@1.0.0~audit: npm_config_yes set to true
# added 2 packages, and audited 156 packages in 3s
```

#### yarn audit
```bash
# Scan
yarn audit

# Auto-fix
yarn audit --fix

# Output format similar to npm audit
```

### Rust Ecosystem

#### cargo audit
```bash
# Install
cargo install cargo-audit

# Scan
cargo audit

# JSON output
cargo audit --json

# Only deny vulnerabilities
cargo audit --deny warnings

# Output:
# Scanning Cargo.lock for known security vulnerabilities
#
# Vulnerabilities found!
#
# Crate:   rusqlite
# Version: 0.25.0
# Issue:   Double-free in rusqlite
# ...
```

---

## Patching Strategies

### Immediate Critical Patches
```bash
# 1. Update only critical/high vulnerabilities
pip-audit --fix --only-critical
# or
npm audit fix --force

# 2. Run test suite
npm test
pytest

# 3. Deploy to production immediately
# (No feature freeze, just security)
```

### Scheduled Patch Windows
```bash
# 1. Create branch for patches
git checkout -b security/critical-patch

# 2. Apply updates
pip install --upgrade -r requirements.txt
npm audit fix

# 3. Test thoroughly
pytest -v
npm test

# 4. Review changes
git diff requirements.txt package.json

# 5. Merge and deploy
git commit -m "security: patch critical vulnerabilities"
git push
```

### Staged Rollout
```bash
# 1. Update in staging
git checkout staging
pip-audit --fix
npm audit fix

# 2. Test in staging environment
# (Run full test suite, manual testing)

# 3. Monitor staging for 24-48 hours
# (Watch logs, performance metrics)

# 4. Merge to production
git checkout main
git merge staging
# (Deploy through CI/CD)
```

---

## Handling Transitive Dependencies

**Problem**: A package you use depends on a vulnerable package.

**Example**:
```
Your app
  ├─ requests 2.31.0
  │   └─ urllib3 < 2.0 (VULNERABLE)
  └─ safe-package (also uses vulnerable urllib3)

Result: urllib3 vulnerability affects your app
```

**Solutions**:

### 1. Update direct dependency
```bash
pip install --upgrade requests
# newer requests uses urllib3 >= 2.0
```

### 2. Force direct dependency override
```bash
# In requirements.txt or pyproject.toml
urllib3 >= 2.0

# Python setup.py
install_requires=[
    'requests>=2.31.0',
    'urllib3>=2.0',  # Override transitive
]
```

### 3. Use lock files (Best Practice)
```bash
# Python (Poetry)
poetry update urllib3

# Node.js (npm)
npm install urllib3@^2.0

# Commit lock file
git add package-lock.json poetry.lock
git commit -m "security: update transitive dependencies"
```

---

## Vulnerability Response Procedures

### For CRITICAL Vulnerabilities

```
Time: T+0 hours
1. Confirm vulnerability affects your application
2. Check if patch available
3. If available: Apply patch immediately
4. If not available: Implement workaround immediately

Time: T+1-2 hours
5. Run test suite
6. Deploy to production
7. Monitor for regressions

Time: T+24 hours
8. If not patched yet, inform stakeholders
9. Plan mitigation strategy
10. Document what you're doing and why
```

### For HIGH Vulnerabilities

```
Time: T+0 hours
1. Document the vulnerability
2. Assess impact on your application
3. Plan patch (if needed)

Time: T+1 business day
4. Apply patch in development
5. Run test suite
6. Deploy to staging

Time: T+3 business days
7. Deploy to production (with monitoring)
8. Close ticket once confirmed working
```

### For MEDIUM Vulnerabilities

```
Time: T+0
1. Log in issue tracker
2. Add to next security update cycle

Time: T+2 weeks (next update cycle)
3. Apply patch
4. Run tests
5. Deploy with other updates
```

### For LOW Vulnerabilities

```
Time: T+0
1. Log in issue tracker
2. Include in quarterly dependency review

Time: Quarterly or as needed
3. Apply patch when next updating this package
```

---

## Monitoring & Alerts

### GitHub Dependabot
GitHub can automatically scan and alert on vulnerabilities:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "daily"
    reviewers:
      - "security-team"

  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 5
```

### Third-Party Monitoring

- **Snyk**: Continuous vulnerability monitoring
- **Black Duck**: Enterprise vulnerability management
- **Sonatype Nexus Lifecycle**: Repository scanning
- **Checkmarx**: Application security scanning

### Manual Monitoring

```bash
# Schedule regular scans
# Daily: pip-audit, npm audit
# Weekly: Full dependency review
# Monthly: Security audit, license check

# Create scan report
pip-audit > vulns_$(date +%Y-%m-%d).txt
npm audit > npm_vulns_$(date +%Y-%m-%d).json

# Review and track
git add reports/
git commit -m "security: vulnerability scan report"
```

---

## Emergency Response Checklist

In case of widespread vulnerability (e.g., Log4j):

```
CRITICAL VULNERABILITY RESPONSE
================================

1. Assessment (T+0 to T+2 hours)
   [ ] Identify package and affected versions
   [ ] Determine if your app uses it
   [ ] Assess severity (RCE, DoS, information leak?)
   [ ] Check if patch is available
   [ ] Estimate time to patch

2. Immediate Mitigation (T+0 to T+4 hours)
   [ ] Apply patch if available
   [ ] Implement workaround if not
   [ ] Deploy to production
   [ ] Monitor for side effects

3. Communication (T+1 hour)
   [ ] Alert management/security team
   [ ] Update incident ticket
   [ ] Notify customers if affected
   [ ] Provide status updates

4. Validation (T+4 to T+24 hours)
   [ ] Run full test suite
   [ ] Manual testing of critical paths
   [ ] Monitor logs for issues
   [ ] Confirm vulnerability fixed

5. Post-Incident (T+24 to T+72 hours)
   [ ] Document what happened
   [ ] Review response procedure
   [ ] Update security policy
   [ ] Share lessons learned
```

---

## Summary: Security Scanning Best Practices

1. **Scan regularly** - Daily for critical apps, weekly for others
2. **Prioritize by severity** - CRITICAL first, then HIGH, then MEDIUM
3. **Test before deploying** - Run full test suite after updates
4. **Use lock files** - Ensures reproducible and auditable builds
5. **Monitor transitive** - Watch dependencies of dependencies
6. **Automate scanning** - Use tools like Snyk, Dependabot, or GitHub Actions
7. **Have procedures** - Know what to do for different severity levels
8. **Document changes** - Always explain why and what changed
9. **Stay informed** - Subscribe to security mailing lists
10. **Educate team** - Everyone should understand vulnerability risk
