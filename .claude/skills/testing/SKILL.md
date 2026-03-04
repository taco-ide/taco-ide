---
name: testing
description: Test patterns, coverage requirements, and testing workflows
---

# Testing Skill

## Overview
Testing standards and patterns for the TACO-IDE project.
Referenced by Developer subagent when writing tests.

## Contents

### Patterns
- `context/unit-test-patterns.md` - Unit testing best practices
- `context/integration-patterns.md` - Integration testing patterns

## Current State
This project does not yet have a test suite. When setting up testing:
- Use **Vitest** as the test runner (compatible with the TypeScript/Vite ecosystem)
- Use `@fastify/inject` or `light-my-request` for API route testing
- Use React Testing Library for frontend component tests

## Requirements
- All new features should include tests
- All bug fixes should include regression tests
- Target minimum coverage: 80%

## Running Tests
Once set up:
- `npm run test` - Run all tests (from root via Turborepo)
- `cd apps/api && npm run test` - API tests only
- `cd apps/web && npm run test` - Frontend tests only
