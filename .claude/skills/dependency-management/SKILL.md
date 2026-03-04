---
name: dependency-management
description: Best practices for dependency updates, security, and license compliance
---

# Dependency Management Skill

## Overview

This skill contains comprehensive guidance for managing project dependencies across multiple ecosystems. It covers update strategies, security vulnerability assessment, and license compliance.

Referenced by DependencyManager subagent when planning and executing dependency updates.

## When to Use

**DependencyManager Agent**: Read this skill before updating dependencies to understand:
- Update strategy selection (conservative, moderate, aggressive)
- Breaking change detection from changelogs
- Security vulnerability assessment methodology
- License compatibility rules
- Testing requirements for different update types

## Contents

### Reference Materials
- `context/update-strategies.md` - Semantic versioning, update strategies, changelog analysis, testing
- `context/security-scanning.md` - CVE databases, severity classification, vulnerability assessment
- `context/license-compliance.md` - License types, compatibility matrix, compliance tools

## Key Principles

1. **Safety First** - Conservative defaults, user approval for major updates
2. **Transparency** - Always explain why an update is recommended
3. **Validation** - Test all updates before applying
4. **Documentation** - Provide migration guides for breaking changes
5. **Automation** - Use tools where possible (pip-audit, npm audit, cargo audit)

## Update Categories

- **Patch** (1.2.3 → 1.2.4): Bug fixes, no breaking changes - safe to auto-update
- **Minor** (1.2.3 → 1.3.0): New features, backwards compatible - needs testing
- **Major** (1.2.3 → 2.0.0): Breaking changes - needs migration guide and approval

## Ecosystems Supported

- **Python**: pip, poetry, pipenv
- **JavaScript/Node.js**: npm, yarn, pnpm
- **Rust**: cargo
- **Java**: Maven, Gradle
- **Go**: Go modules
- **Ruby**: Bundler
- **PHP**: Composer

## Quick Reference

### Security Scanning Tools
- Python: `pip-audit`, `safety`
- Node.js: `npm audit`, `yarn audit`
- Rust: `cargo audit`
- Java: OWASP Dependency-Check
- Go: `nancy`

### License Checking Tools
- Python: `pip-licenses`, `pip-audit`
- Node.js: `license-checker`, `npm-check-licenses`
- Rust: `cargo-deny`
- General: FOSSA, Black Duck, Synopsys

### Unused Dependency Detection
- Python: `vulture`, `importlib-metadata`
- Node.js: `depcheck`, `npm-check`
- Rust: `cargo-machete`
- General: static analysis, test coverage analysis
