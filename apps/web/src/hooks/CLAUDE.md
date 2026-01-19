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
