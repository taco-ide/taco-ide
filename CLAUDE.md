# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TACO-IDE is an intelligent educational platform designed to help teachers create and manage Python programming exercises with AI support. Built as a **Turborepo monorepo** with a Fastify backend and Next.js frontend.

## Monorepo Structure

```
taco-ide/
├── apps/
│   ├── api/          # Fastify backend API (port 3344)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   ├── infra/        # Shared infrastructure (DB, Auth, Docker)
│   ├── types/        # Generated TypeScript types (Kubb)
│   ├── eslint-config/
│   └── typescript-config/
```

## Core Technology Stack

- **Backend**: Fastify 5, Zod validation, Swagger/OpenAPI, Better Auth
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Radix UI, Zustand, React Query
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth (email/password, password reset)
- **Code Generation**: Kubb (generates types, React Query hooks, Zod schemas from OpenAPI)
- **Monorepo**: Turborepo with npm workspaces

## Development Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- npm 11+

### Initial Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL container
cd packages/infra
npm run services:up

# Apply database schema (no migrations)
npm run db:push

# Seed initial data
npm run db:seed

# Optional: Open Drizzle Studio
npm run db:studio
```

### Environment Variables

Copy `.env.example` to `.env` in the project root:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taco_dev

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3344

# Frontend (apps/web/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3344
```

### Running the Application

```bash
# From root - start all apps
npm run dev

# Or start individually:
cd apps/api && npm run dev    # API on :3344
cd apps/web && npm run dev    # Web on :3000
```

## Common Development Commands

### Root Level
| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all packages |
| `npm run check-types` | Type check all packages |

### Database (packages/infra)
| Command | Description |
|---------|-------------|
| `npm run services:up` | Start PostgreSQL container |
| `npm run services:stop` | Stop PostgreSQL container |
| `npm run services:down` | Stop and remove container/volumes |
| `npm run db:generate` | Generate Drizzle migration |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema (no migration files) |
| `npm run db:studio` | Open Drizzle Studio UI |
| `npm run db:seed` | Seed database with initial data |

### API (apps/api)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Build for production |
| `npm run kubb` | Generate types and hooks from OpenAPI |
| `npm run typecheck` | TypeScript check |

### Frontend (apps/web)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run typecheck` | TypeScript check |

## Key Architectural Patterns

### Code Generation Flow (Kubb)

When API routes change:
1. Update route files in `apps/api/src/http/routes/v1/`
2. Define Zod schemas for request/response
3. Run `cd apps/api && npm run kubb`
4. This generates:
   - TypeScript types → `packages/types/kubb/`
   - React Query hooks → `apps/web/src/kubb/hooks/`
   - Zod schemas → `apps/api/src/gen/kubb/zod/`

### Database Schema Changes

1. Modify schema in `packages/infra/src/db/schema/`
2. Run `cd packages/infra && npm run db:generate` (creates migration)
3. Run `npm run db:migrate` (applies migration)
4. **OR** use `npm run db:push` for prototyping (no migration files)

### Adding New API Routes

1. Create route file in `apps/api/src/http/routes/v1/{module}/{action}.ts`
2. Define Zod schemas for validation
3. Register in module's `index.ts`
4. Register module in `apps/api/src/http/routes/v1/index.ts`
5. Run `npm run kubb` to generate client code

### Authentication Flow

- Better Auth handles all auth via `@repo/infra/auth`
- Auth routes automatically available at `/v1/auth/*`
- Session management via cookies
- Frontend uses `@repo/infra/auth/client` for auth operations

## API Documentation

When API is running:
- Swagger UI: http://localhost:3344/docs
- OpenAPI JSON: http://localhost:3344/docs/json
- OpenAPI YAML: `apps/api/src/swagger.yaml` (auto-generated)

## MCP Server Configuration

This project uses the following MCP servers (see `.cursor/mcp.json`):
- **PostgreSQL**: Direct database access
- **context7**: Context management with 10,000 minimum tokens
- **Better Auth**: Authentication builder
- **shadcn**: Component installation
- **trigger**: Trigger.dev integration (dev only)

## Package Dependencies

Workspace packages reference each other:
- `@repo/infra` - Used by both apps/api and apps/web
- `@repo/types` - Used by apps/web (generated by Kubb)

Changes to `packages/infra` require rebuilding consuming apps.

## Important File Locations

- API routes: `apps/api/src/http/routes/v1/`
- Frontend pages: `apps/web/src/app/`
- Database schema: `packages/infra/src/db/schema/`
- Shared types: `packages/types/kubb/` (generated)
- Auth config: `packages/infra/src/auth/`
- Environment validation: `packages/infra/src/env.ts`

## Documentation Structure

This repository uses directory-specific CLAUDE.md files throughout:

### Root Documentation
- **This file** - Monorepo overview and common commands

### App Documentation
- **Backend API**: `apps/api/CLAUDE.md` - Fastify backend guide
  - `apps/api/src/CLAUDE.md` - API source structure
  - `apps/api/src/http/CLAUDE.md` - HTTP layer details
  - `apps/api/src/http/routes/CLAUDE.md` - Route patterns

- **Frontend**: `apps/web/CLAUDE.md` - Next.js frontend guide
  - `apps/web/src/CLAUDE.md` - Web source structure
  - `apps/web/src/app/CLAUDE.md` - Next.js App Router
  - `apps/web/src/components/CLAUDE.md` - UI components
  - `apps/web/src/contexts/CLAUDE.md` - React contexts
  - `apps/web/src/hooks/CLAUDE.md` - Custom hooks
  - `apps/web/src/store/CLAUDE.md` - Zustand stores
  - `apps/web/src/lib/CLAUDE.md` - Utilities
  - `apps/web/src/types/CLAUDE.md` - Type definitions
  - `apps/web/src/data/CLAUDE.md` - Static data

### Package Documentation
- **Infrastructure**: `packages/infra/CLAUDE.md` - Shared infra package
  - `packages/infra/src/db/CLAUDE.md` - Database layer (Drizzle)
  - `packages/infra/src/auth/CLAUDE.md` - Better Auth setup
- **Types**: `packages/types/CLAUDE.md` - Shared type definitions (Kubb-generated)
