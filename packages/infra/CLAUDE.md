# packages/infra - Shared Infrastructure Package

This package provides shared infrastructure for database, authentication, and environment configuration used by both the API and web applications.

## Package Exports

```typescript
// Database
import { db } from "@repo/infra/db"
import { schema } from "@repo/infra/db/schema"

// Authentication
import { auth } from "@repo/infra/auth"              // Server-side auth instance
import { authClient } from "@repo/infra/auth/client" // Client-side auth

// Environment
import { env } from "@repo/infra/env"  // Validated environment variables
```

## Directory Structure

```
packages/infra/
├── src/
│   ├── auth/         # Better Auth configuration
│   ├── db/           # Drizzle ORM setup and schema
│   └── env.ts        # Environment variable validation
├── docker/           # Docker Compose for PostgreSQL
├── drizzle.config.ts # Drizzle Kit configuration
└── package.json
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run services:up` | Start PostgreSQL container |
| `npm run services:stop` | Stop PostgreSQL container |
| `npm run services:down` | Remove container and volumes |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Apply migrations to database |
| `npm run db:push` | Push schema directly (no migrations) |
| `npm run db:studio` | Open Drizzle Studio UI |
| `npm run db:seed` | Seed database with initial data |

## Database Workflow

### For Development (Prototyping)
```bash
# Make schema changes in src/db/schema/
# Then push directly to database
npm run db:push
```

### For Production (Migrations)
```bash
# Make schema changes in src/db/schema/
# Generate migration file
npm run db:generate

# Apply migration
npm run db:migrate
```

## Environment Variables

All environment variables are loaded from a single root `.env` file (loaded via `dotenv-cli` before Turbo, so all apps inherit them). Create `.env` at the monorepo root:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taco_dev

# Auth
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3344
FRONTEND_URL=http://localhost:3000

# Email (optional)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# LLM (LangGraph.js agents)
LLM_API_KEY=your-azure-openai-key
LLM_API_BASE=https://your-resource.openai.azure.com/openai/v1/
LLM_MODEL_NAME=gpt-5.2-chat
CODE_EXEC_API_URL=https://emkc.org/api/v2/piston/execute

# Server
PORT=3344
```

For the frontend, also create `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3344
```

## Usage in Applications

### Using Database
```typescript
import { db } from "@repo/infra/db"
import { schema } from "@repo/infra/db/schema"

// Query users
const users = await db.select().from(schema.user)

// Insert with type safety
await db.insert(schema.user).values({
  name: "John Doe",
  email: "john@example.com",
  emailVerified: false,
})
```

### Using Authentication (Server)
```typescript
import { auth } from "@repo/infra/auth"

// In API routes
const session = await auth.api.getSession({ headers: request.headers })
```

### Using Authentication (Client)
```typescript
import { authClient } from "@repo/infra/auth/client"

// Sign in
await authClient.signIn.email({ email, password })

// Get session
const session = await authClient.getSession()

// Sign out
await authClient.signOut()
```

## Docker Setup

PostgreSQL runs in a Docker container configured in `docker/compose.yaml`:
- **Port**: 5432
- **Database**: taco_dev
- **User**: postgres
- **Password**: postgres

## RBAC

Role-based access control is defined in `src/auth/permissions.ts`. Available roles (in hierarchy order):
- `student` - No management permissions
- `teacher` - Can manage classrooms, challenges, teaching assistants
- `coordinator` - Can manage members and invitations in addition to teacher permissions
- `admin` - Full organization control

Import RBAC helpers from `@repo/infra/auth/client` in the frontend or `@repo/infra/auth` on the server.

## Important Notes

- This is a shared package - changes affect both apps
- After modifying this package, rebuild consuming apps
- Schema changes require either `db:push` or `db:generate` + `db:migrate`
- Better Auth tables are defined in `src/db/schema/auth.ts`
- Application tables are defined in `src/db/schema/app.ts`
- Environment is loaded from root `.env` — do NOT create per-app env files for shared variables

## Related Documentation

- Database schema: `src/db/CLAUDE.md`
- Auth configuration: `src/auth/CLAUDE.md`
