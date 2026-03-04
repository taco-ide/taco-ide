# License Compliance for Dependencies

## License Basics

### What is Open Source Licensing?

Open source licenses define legal permissions and restrictions for software use, modification, and distribution.

**Key Rights & Restrictions**:
- Can you use commercially?
- Can you modify?
- Can you distribute?
- Must you distribute source?
- Must you provide attribution?

### Why Licenses Matter

- **Legal**: Violation can result in lawsuits, forced open source release
- **Commercial**: Some licenses incompatible with proprietary software
- **Compliance**: Regulations (GDPR, etc.) may require disclosure
- **Community**: Respect for open source developers' intentions

---

## Common Open Source Licenses

### Permissive Licenses (Use freely)

#### MIT License
**Permissions**: Commercial use, modification, distribution, private use
**Requirements**: License and copyright notice
**Restrictions**: Liability, warranty
**Commercial Use**: Yes ✓
**Example**: Lodash, React, Node.js

```
MIT License text:
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files...
```

**When to Use**: Default choice for open source projects

---

#### Apache 2.0 License
**Permissions**: Commercial use, modification, distribution, private use
**Requirements**: License, copyright notice, state changes
**Restrictions**: Trademark use, liability, warranty
**Commercial Use**: Yes ✓
**Patent Protection**: Included ✓
**Example**: TensorFlow, Kubernetes, Android

```
Similar to MIT but with explicit patent grant and
stronger explicit statement of changes required.
```

**When to Use**: Enterprise software, projects needing patent protection

---

#### BSD Licenses (2-Clause, 3-Clause)
**Permissions**: Commercial use, modification, distribution, private use
**Requirements**: License and copyright notice
**Restrictions**: Liability, warranty
**Commercial Use**: Yes ✓
**Example**: Django, Flask, NumPy

**Difference**:
- 2-Clause: MIT equivalent
- 3-Clause: Adds non-endorsement clause

**When to Use**: Similar to MIT, slightly stricter non-endorsement

---

#### ISC License
**Permissions**: Commercial use, modification, distribution, private use
**Requirements**: License and copyright notice
**Restrictions**: Liability, warranty
**Commercial Use**: Yes ✓
**Example**: Semver, Caniuse

```
Very permissive, essentially same as MIT but simpler wording
```

**When to Use**: Similar to MIT, simpler wording preferred

---

### Copyleft Licenses (Share-alike required)

#### GPL-2.0 / GPL-3.0 (GNU General Public License)
**Permissions**: Commercial use, modification, distribution
**Requirements**: License and copyright notice, source code, state changes, disclose source
**Restrictions**: Liability, warranty
**Commercial Use**: Yes, but with conditions
**Open Source Required**: Yes ✓✓✓
**Example**: Linux Kernel, WordPress, Git

```
If you distribute software using GPL:
- You must open source your code
- You must license your code under GPL
- You must provide source to users
```

**Critical Issue**: GPL code "infects" your codebase!

**When to Use**: Only if you want to open source your work

---

#### AGPL-3.0 (GNU Affero General Public License)
**Like**: GPL-3.0 but stricter
**Requirements**: Same as GPL-3.0
**Restrictions**: All of GPL-3.0 PLUS network use triggers distribution obligation
**Commercial Use**: Yes, but must open source
**Open Source Required**: Yes ✓✓✓
**Example**: MongoDB (now dual-licensed)

```
If someone uses your software over a network (SaaS):
- They must provide source code to users
- Even if they don't distribute files
```

**Critical**: Even SaaS products must share source

**When to Use**: Only if you want others to open source modifications

---

#### LGPL-2.1 / LGPL-3.0 (Lesser GPL)
**Like**: GPL but more permissive
**Permissions**: Commercial use, modification, distribution, linking
**Requirements**: License notice, source code for LGPL, state changes
**Restrictions**: Some GPL requirements, liability, warranty
**Commercial Use**: Yes ✓
**Linking**: Allowed (can use in proprietary code) ✓
**Open Source Required**: Only the LGPL component

```
Difference from GPL:
- Can link to proprietary code
- Only LGPL component must be open source
- Can use in proprietary applications
```

**When to Use**: Libraries you want used in proprietary software

---

### Other Important Licenses

#### MPL-2.0 (Mozilla Public License)
**Permissions**: Commercial use, modification, distribution, linking
**Requirements**: License and copyright, source code, state changes, disclose source
**Restrictions**: Liability, warranty, trademark
**Commercial Use**: Yes ✓
**Open Source Required**: Only the MPL component
**Example**: Firefox

```
Like LGPL but:
- More complex patent language
- Different file-level open source requirement
```

**When to Use**: Enterprise software with patent concerns

---

#### Unlicense
**Permissions**: Everything (no restrictions)
**Requirements**: None
**Restrictions**: None (no liability or warranty disclaimer)
**Commercial Use**: Yes ✓
**Example**: Some small utilities

```
Releases software into public domain.
Essentially "do whatever you want"
```

**When to Use**: Small utilities, non-critical code

---

## License Compatibility Matrix

### Can I use this license in my project?

```
My Project License: MIT (permissive)

License Compatibility:
MIT             ✓ Same license required (good practice)
Apache 2.0      ✓ Can use, include notices
BSD             ✓ Can use, include notices
ISC             ✓ Can use, include notices
LGPL            ✓ Can use, must provide source of LGPL code
GPL             ✗ CANNOT USE - incompatible!
AGPL            ✗ CANNOT USE - incompatible!
Public Domain   ✓ Can use, no requirements
```

### Common Scenario: MIT Project

**Can use**:
- Any permissive license (MIT, Apache, BSD, ISC)
- LGPL (can link to proprietary)
- Unlicense/Public Domain

**CANNOT use**:
- GPL (would force entire project to GPL)
- AGPL (same issue, even stricter)

**What to do if want to use GPL**:
1. Switch project to GPL (now open source!)
2. Don't use GPL code (remove it)
3. Find alternative non-GPL library

### Common Scenario: GPL Project

**Can use**:
- MIT, Apache, BSD, ISC, LGPL, GPL
- Anything, since already open source

**Must do**:
- Release entire project under GPL
- Provide source to anyone who distributes

---

## License Compliance Checking

### Tools for License Detection

#### Python
```bash
# pip-licenses (recommended)
pip install pip-licenses
pip-licenses --format json --output-file licenses.json
pip-licenses --format table

# Output:
# | Name      | Version | License    |
# |-----------|---------|------------|
# | requests  | 2.31.0  | Apache 2.0 |
# | django    | 4.2.0   | BSD        |
# | flask     | 2.3.0   | BSD        |
```

#### Node.js
```bash
# license-checker
npm install -g license-checker
license-checker --json > licenses.json
license-checker --markdown > LICENSES.md

# npm-check-licenses
npm install -g npm-check-licenses
npm-check-licenses

# Output:
# ✓ valid    - MIT
# ✗ invalid  - GPL (incompatible)
# ⚠ unknown  - no license found
```

#### Rust
```bash
# cargo-deny
cargo install cargo-deny
cargo deny check licenses

# Output:
# Checking licenses
#
# Crate:  serde
# License: MIT OR Apache-2.0
# Status:  ✓ Allowed
#
# Crate:  gpl-package
# License: GPL-3.0
# Status:  ✗ Denied
```

#### General Tools
- **FOSSA**: Automated license scanning, compliance management
- **Black Duck**: Commercial license management
- **Synopsys**: Enterprise compliance tool

---

## Setting Up Compliance Policy

### Step 1: Define Your Project License

**Decide**:
```
License for my project:
[ ] MIT - Permissive, most compatible
[ ] Apache 2.0 - Permissive + patent protection
[ ] GPL - Open source only
[ ] Dual-licensed - Open and commercial
[ ] Commercial only - No external open source
```

### Step 2: Define Allowed Licenses

Create a policy file:

```yaml
# .license-policy.yml
name: "MyProject License Policy"
project_license: "MIT"

# Licenses we can use
allowed_licenses:
  - MIT
  - Apache-2.0
  - BSD-2-Clause
  - BSD-3-Clause
  - ISC

# Licenses we explicitly cannot use
forbidden_licenses:
  - GPL-2.0
  - GPL-3.0
  - AGPL-3.0
  - SSPL

# Licenses that need review
review_licenses:
  - LGPL-2.1  # Usually OK but depends on usage
  - LGPL-3.0
  - MPL-2.0
  - EPL-1.0
```

### Step 3: Document All Licenses

Create file listing all dependencies:

```markdown
# Third-Party License Attribution

This project uses the following open source dependencies:

## MIT License
- lodash (MIT) - Utility library

## Apache 2.0 License
- requests (Apache 2.0) - HTTP library
- tensorflow (Apache 2.0) - ML framework

## BSD License
- django (BSD 3-Clause) - Web framework
- numpy (BSD 3-Clause) - Numerical library
```

### Step 4: Automate Compliance Checking

Create GitHub Actions workflow:

```yaml
# .github/workflows/license-check.yml
name: License Compliance Check

on: [pull_request]

jobs:
  license-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check Python licenses
        run: |
          pip install pip-licenses
          pip-licenses --format json --output-file licenses.json
          python check_licenses.py licenses.json

      - name: Check JS licenses
        run: |
          npm install
          npm run license-check

      - name: Check Rust licenses (if applicable)
        run: |
          cargo deny check licenses
```

---

## Handling Problematic Licenses

### Scenario 1: Dependency Uses GPL

**Problem**: You want to use library licensed under GPL in proprietary project

**Option 1: Change Project License**
```
Switch to GPL (must open source entire project)
Pros: Can use GPL libraries, clear license
Cons: Project must be open source
Recommendation: Only if you intended open source anyway
```

**Option 2: Find Alternative**
```
Find non-GPL library with same functionality
Pros: Keep proprietary license, no compliance issues
Cons: May need to change code, alternative may not exist
Recommendation: Try this first
```

**Option 3: Commercial License**
```
Purchase commercial license from author
Pros: Keep proprietary license, use desired library
Cons: Costs money, may not be available
Recommendation: For critical libraries, contact author
```

**Option 4: Dual License**
```
License your project under both MIT and GPL
Pros: Can use MIT libraries and GPL libraries
Cons: More complex, confusing for users
Recommendation: Only if you support both use cases
```

### Scenario 2: Transitive GPL Dependency

**Problem**: Library you use depends on GPL code

**Example**:
```
Your App (MIT)
  └─ awesome-lib (MIT)
      └─ gpl-code (GPL)
```

**Check the License Terms**:
```
LGPL: Can use (only LGPL part must be disclosed)
GPL: CANNOT use (taints entire project)
```

**If GPL**: Follow options above

### Scenario 3: Unclear or Missing License

**Problem**: Dependency has no license file

**Steps**:
1. Check package repository for license info
2. Look at source code for license header
3. Check npm registry / PyPI page
4. Contact author for clarification
5. If still unclear: DO NOT USE (too risky)

```bash
# Check for license in multiple places
cat LICENSE
cat LICENSE.md
cat LICENSE.txt
head -10 setup.py  # May have license field
grep -r "license" package.json  # May declare license
```

---

## License Compliance Checklist

### Before Adding New Dependency

- [ ] Check package license
- [ ] Verify license is in allowed list
- [ ] Read package README for any license notes
- [ ] Check transitive dependencies (use pip-tree, npm list)
- [ ] Document license in LICENSES file
- [ ] Get approval if license on review list
- [ ] Add to license compliance CI check

### Before Release

- [ ] Run license check tool
- [ ] Verify all licenses documented
- [ ] Include license attribution file
- [ ] Check for license violations
- [ ] Update THIRD_PARTY_LICENSES file
- [ ] Verify legal team approved (if required)

### Quarterly Compliance Review

- [ ] Scan all dependencies for new versions
- [ ] Check for license changes in new versions
- [ ] Review any deprecated/removed licenses
- [ ] Update compliance documentation
- [ ] Report to legal/management
- [ ] Plan any remediation

---

## Creating Proper Attribution

### LICENSE Attribution File Template

```markdown
# Third-Party Licenses

This software includes open source software from the projects listed below.

## requests
License: Apache License 2.0
Source: https://github.com/psf/requests
Copyright: (c) 2011 Kenneth Reitz

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
[Full Apache 2.0 license text...]

---

## Django
License: BSD 3-Clause License
Source: https://github.com/django/django
Copyright: Django Software Foundation

[Full BSD 3-Clause license text...]

---

[Continue for all dependencies...]
```

### Automated Generation

```bash
# Python
pip-licenses --format markdown --output-file THIRD_PARTY_LICENSES.md

# Node.js
license-checker --markdown > THIRD_PARTY_LICENSES.md

# Rust
cargo license --json > licenses.json
```

---

## Best Practices for License Compliance

1. **Know your project's license** - Be clear about yours first
2. **Document all dependencies** - Maintain LICENSES file
3. **Automate scanning** - Use tools, don't rely on memory
4. **Check during review** - Catch license issues in PR review
5. **Understand GPL risk** - GPL "infects" proprietary code
6. **Prefer permissive** - MIT, Apache, BSD are compatible with most projects
7. **LGPL is safer than GPL** - Can use in proprietary with caveats
8. **Monitor updates** - License can change in new versions
9. **Get legal review** - For complex cases, consult legal team
10. **Communicate clearly** - Document compliance approach

---

## Common Questions

**Q: Can I use MIT code in Apache 2.0 project?**
A: Yes. Permissive licenses are compatible. Include the MIT license notice.

**Q: Can I use Apache 2.0 code in MIT project?**
A: Yes. Include the Apache 2.0 notice. Your project stays MIT.

**Q: Can I use GPL code in proprietary project?**
A: No. GPL requires you to open source your code. Either switch to GPL or remove GPL code.

**Q: What about LGPL in proprietary project?**
A: Usually yes. LGPL requires source disclosure of only the LGPL component, not your proprietary code. Check terms carefully.

**Q: Do I need to include full license text?**
A: Yes. Include full text with proper attribution in THIRD_PARTY_LICENSES or LICENSE.dependencies file.

**Q: What if license field is blank in package.json?**
A: That's a red flag. Contact author, check README, or avoid the package.

**Q: Can I change the license of code I receive?**
A: No. The original license applies to your use. You can only change license of code you write.
