# src/ Directory Guide

This is the main source directory containing all application code.

## Directory Structure

```
src/
├── app/           # Next.js App Router - pages and API routes
├── components/    # Reusable React components
├── contexts/      # React Context providers
├── data/          # Static data files (JSON)
├── hooks/         # Custom React hooks
├── lib/           # Utility functions and shared logic
├── store/         # Zustand state management stores
├── types/         # TypeScript type definitions
└── middleware.ts  # Next.js middleware for auth
```

## Key Files

### middleware.ts
Global middleware that handles authentication for all routes. It:
- Defines public paths that don't require authentication
- Validates JWT session tokens for protected routes
- Redirects unauthenticated users to login page
- Returns 401 for unauthorized API requests

## Conventions

### Imports
- Use `@/` alias for imports from `src/` directory
- Example: `import { Button } from "@/components/ui/button"`

### File Organization
- Keep related files together in feature folders
- Use `_components/` for route-specific components
- Use `_constants/` for route-specific constants

### TypeScript
- Define shared types in `types/index.ts`
- Use interfaces for object shapes
- Use Zod schemas for runtime validation (in `lib/auth/schemas.ts`)
