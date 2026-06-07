# CLAUDE.md - TACO-IDE Web Frontend Guide

## Project Overview

TACO-IDE is an intelligent educational platform designed to help teachers create and manage Python programming exercises with AI support. This is the **web frontend** application built with Next.js.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **State Management**: Zustand
- **Authentication**: Better Auth (via `@repo/infra`)
- **API Client**: Custom fetch wrapper for Fastify backend
- **Code Editor**: Monaco Editor
- **i18n**: next-intl (English + Brazilian Portuguese)

## Internationalization (i18n)

The whole UI is translatable to English (`en`, the default/fallback) and
Brazilian Portuguese (`pt`) via **next-intl**, cookie-based (no `[locale]` URL
segments).

- **Config**: `src/i18n/config.ts` (locales, default, cookie name `NEXT_LOCALE`)
  and `src/i18n/request.ts` (resolves the locale from the cookie per request).
  The plugin is wired in `next.config.mjs`.
- **Messages**: `src/messages/en.json` and `src/messages/pt.json`. Keys are
  grouped by feature namespace (e.g. `home`, `auth`, `admin`, `problem`).
  `common` holds generic shared words.
- **Switching**: `<LanguageSwitcher>` (`src/components/language-switcher.tsx`)
  sets the cookie via the `setLocale` server action (`src/app/actions/locale.ts`)
  and refreshes — the choice persists across the whole platform.
- **Usage**: Client components → `const t = useTranslations("namespace")` then
  `t("key")`; inline markup → `t.rich(...)`. Server components → `await getTranslations(...)`.
- **Adding strings**: add the key to BOTH `en.json` and `pt.json` under the right
  namespace, then run `node scripts/check-i18n-keys.mjs` to verify every literal
  `t()`/`t.rich()` call resolves in both locales (en/pt key parity).

## Landing Page

The public landing page lives in `src/app/(home)/` and is composed of section
components under `_components/landing/` (Nav, Hero, IdeDemo, Duo, AiFeedback,
OpenSource, FinalCta, Footer) plus a `Reveal` scroll-in wrapper (framer-motion).
Contributor avatars come from `src/data/collaborators.json` (real GitHub photos).

## Architecture

This frontend communicates with a separate Fastify backend (`apps/api`). Authentication is handled by Better Auth through the `@repo/infra` package.

```
apps/web/          <- This app (Next.js frontend)
apps/api/          <- Fastify backend API
packages/infra/    <- Shared infrastructure (DB, Auth)
packages/types/    <- Shared TypeScript types
```

## Quick Start

```bash
# From monorepo root
npm install

# Start infrastructure (PostgreSQL)
cd packages/infra && npm run docker:up

# Apply database migrations
cd packages/infra && npm run db:push

# Seed the database
cd packages/infra && npm run db:seed && npm run db:seed:dev

# Start the API server (in one terminal)
cd apps/api && npm run dev

# Start the web frontend (in another terminal)
cd apps/web && npm run dev
```

## Project Structure

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router (pages)
│   ├── components/       # Reusable UI components
│   ├── lib/              # Utility functions
│   │   ├── auth.ts       # Better Auth client re-export
│   │   ├── apiClient.ts  # API client for Fastify backend
│   │   ├── schemas.ts    # Zod validation schemas
│   │   └── utils.ts      # General utilities
│   ├── contexts/         # React contexts (UserContext)
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand state stores
│   ├── kubb/             # Generated API hooks (by Kubb)
│   └── types/            # TypeScript type definitions
└── public/               # Static assets
```

## Key Commands

| Command             | Description              |
| ------------------- | ------------------------ |
| `npm run dev`       | Start Next.js dev server |
| `npm run build`     | Build for production     |
| `npm run lint`      | Run ESLint               |
| `npm run typecheck` | Run TypeScript check     |

## Authentication Flow

Authentication is handled by Better Auth via the Fastify backend:

1. **Signup**: User submits form -> Better Auth creates user -> Session cookie set
2. **Login**: Validate credentials via Better Auth -> Session cookie set
3. **Protected Routes**: Middleware checks session cookie
4. **Logout**: Better Auth clears session

## Environment Variables

```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Common Patterns

### Making API Calls

```typescript
import { apiClient } from "@/lib/apiClient";

// GET request
const response = await apiClient.get<UserData>("/v1/users/me");

// POST request
const response = await apiClient.post<CreateResult>("/v1/resource", { data });
```

### Using Authentication

```typescript
import { authClient } from "@/lib/auth";

// Sign in
const result = await authClient.signIn.email({ email, password });

// Sign out
await authClient.signOut();

// Get session
const session = await authClient.getSession();
```

### Using the User Context

```typescript
import { useUser } from "@/contexts/UserContext";

function MyComponent() {
  const { user, isLoading, logout } = useUser();

  if (isLoading) return <Loading />;
  if (!user) return <NotAuthenticated />;

  return <div>Hello, {user.name}</div>;
}
```

## Directory Documentation

For detailed guidance on specific directories:
- **Source code**: `src/CLAUDE.md` - Web app source structure
- **App routes**: `src/app/CLAUDE.md` - Next.js pages and routing
- **Components**: `src/components/CLAUDE.md` - UI components
- **Contexts**: `src/contexts/CLAUDE.md` - React contexts
- **Hooks**: `src/hooks/CLAUDE.md` - Custom hooks
- **Store**: `src/store/CLAUDE.md` - Zustand stores
- **Lib**: `src/lib/CLAUDE.md` - Utilities and auth client
- **Types**: `src/types/CLAUDE.md` - Type definitions
- **Data**: `src/data/CLAUDE.md` - Static data files

## Related Documentation

- **Backend API**: `apps/api/CLAUDE.md` - Fastify API guide
- **Infrastructure**: `packages/infra/CLAUDE.md` - Database and auth
- **Database**: `packages/infra/src/db/CLAUDE.md` - Schema and queries
- **Auth**: `packages/infra/src/auth/CLAUDE.md` - Better Auth configuration
- **Shared Types**: `packages/types/` - Generated types from Kubb
