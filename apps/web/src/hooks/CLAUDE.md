# src/hooks/ Directory Guide

This directory contains custom React hooks.

## Files

### useAuth.ts

Hook for client-side authentication operations.

```typescript
function useAuth() {
  const login: (email: string, password: string) => Promise<void>
  const logout: () => Promise<void>
  const isAuthenticated: boolean
}
```

### usePermission.ts

RBAC hooks that read the current user's role from `UserContext`.

```typescript
// Get current user's role
function useRole(): RoleName | null

// Check minimum role hierarchy
function useHasMinimumRole(minimumRole: RoleName): boolean

// Check specific resource permission
function useHasPermission<R extends Resource>(resource: R, action: ActionFor<R>): boolean
```

Usage:
```tsx
import { useHasPermission, useHasMinimumRole } from "@/hooks/usePermission"

const canCreateChallenge = useHasPermission("challenge", "create")
const isAtLeastTeacher = useHasMinimumRole("teacher")
```

Types imported from `@repo/infra/auth/client`: `RoleName`, `Resource`, `ActionFor`.

### useMounted.tsx

Hook to detect if the component has mounted (client-side).

```typescript
function useMounted(): boolean
```

Useful for:
- Preventing hydration mismatches
- Running client-only code
- Handling SSR vs CSR differences

#### Usage
```tsx
import { useMounted } from "@/hooks/useMounted"

function MyComponent() {
  const isMounted = useMounted()

  if (!isMounted) {
    return <ServerFallback />
  }

  return <ClientOnlyContent />
}
```

## Creating New Hooks

1. Create file in `src/hooks/`
2. Name with `use` prefix (`useMyHook.ts`)
3. Export the hook function

### Hook Template
```typescript
import { useState, useEffect } from "react"

export function useMyHook(param: ParamType) {
  const [state, setState] = useState<StateType>(initialValue)

  useEffect(() => {
    // Side effects
  }, [param])

  return {
    state,
    // actions
  }
}
```

## Notes

- Keep hooks focused on a single concern
- Use TypeScript for type safety
- Consider SSR implications
- Document return types and usage
