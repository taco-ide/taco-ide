# src/contexts/ Directory Guide

This directory contains React Context providers for global state management.

## Files

### UserContext.tsx

Manages the current authenticated user state across the application.

#### Interface
```typescript
interface User {
  name?: string;
  role: string;
}

interface UserContextType {
  user: User | null;           // Current user data
  isLoading: boolean;          // Fetching user state
  error: string | null;        // Error message
  fetchUser: () => Promise<void>;  // Refresh user data
  clearUser: () => void;       // Clear user (for logout)
  getFirstName: () => string;  // Get user's first name
  logout: () => Promise<void>; // Logout and redirect
}
```

#### Features
- Auto-fetches user data on mount
- Calls `/api/v1/user` endpoint
- Handles 401 (unauthenticated) gracefully
- Provides logout functionality with redirect

## Usage

### Provider Setup (in layout)
```tsx
import { UserProvider } from "@/contexts/UserContext"

export default function Layout({ children }) {
  return (
    <UserProvider>
      {children}
    </UserProvider>
  )
}
```

### Consuming Context
```tsx
import { useUser } from "@/contexts/UserContext"

function MyComponent() {
  const { user, isLoading, logout, getFirstName } = useUser()

  if (isLoading) return <Loading />
  if (!user) return <LoginPrompt />

  return (
    <div>
      <span>Welcome, {getFirstName()}</span>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## Logout Flow

1. Sets loading state
2. Calls `POST /api/v1/auth/logout`
3. Clears user state
4. Redirects to `/auth/login`

## Notes

- User data is fetched client-side after hydration
- The middleware handles redirects for unauthenticated users
- Role information is available for role-based UI rendering
