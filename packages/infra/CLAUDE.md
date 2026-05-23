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

Required environment variables (validated by `src/env.ts`):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taco_dev
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3344
RESEND_API_KEY=re_xxxxxxxxxxxxx  # For email sending
```

Optional platform admin envs (consumed by `npm run db:seed`):

```env
PLATFORM_ADMIN_EMAIL=admin@example.com
PLATFORM_ADMIN_PASSWORD=at-least-12-chars
PLATFORM_ADMIN_NAME=Platform Admin
```

If any of the three is missing, the seed logs a warning and skips the
admin step without raising.

Optional platform professor envs (consumed by `npm run db:seed`):

```env
PLATFORM_PROFESSOR_EMAIL=professor@example.com
PLATFORM_PROFESSOR_PASSWORD=at-least-12-chars
PLATFORM_PROFESSOR_NAME=Platform Professor
PLATFORM_PROFESSOR_ORG_SLUG=my-org  # optional: links the professor as a teacher to the org
```

If any of the three required fields is missing, the seed logs a warning and skips the
professor step. If `PLATFORM_PROFESSOR_ORG_SLUG` is set but the org is not found,
logs a warning and skips membership without throwing.

Environment files are loaded from:
- `apps/api/.env.development`
- `apps/web/.env.local`

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

## Seeds

Seed entry points live in `src/db/seeds/`:

- `base.ts` — structural data shared across environments (default model and
  teaching assistant). Also calls `seedPlatformAdmin()` when the
  `PLATFORM_ADMIN_*` envs are present (skipped with a warning otherwise).
- `dev.ts` — fake organization, users (teacher/student/coordinator),
  classrooms and challenges. Refuses to run with `NODE_ENV=production`.
- `prod.ts` — production-safe seed (no fake data).
- `admin.ts` — idempotent platform admin seed. Upserts the user marked
  with `is_platform_admin=true`, `email_verified=true`, `is_active=true`
  and the matching `account` credential (password hashed via
  `better-auth/crypto`). Re-running rotates the password if the env
  changes.

Run with `npm run db:seed` (base + admin), `npm run db:seed:dev` or
`npm run db:seed:prod`.

## Schema additions

Two cross-cutting concepts are part of the auth schema:

- `user.is_platform_admin: boolean` — cross-organization admin role,
  separate from `member.role`. Declared as a Better Auth additional field
  with `input: false` so clients cannot self-promote.
- `organization.is_active: boolean` and `organization.updated_at` — soft
  deactivation and write tracking for orgs.
- `member` has `UNIQUE(organization_id, user_id)` and `INDEX(user_id)`.
- `organization_email_domain (id, organization_id, domain, role,
  created_at)` — auto-link rules for new sign-ups; `UNIQUE(domain, role)`
  is global so a `(domain, role)` pair can only point to one org.

## Teaching Assistants

Teaching assistants are scoped to an organization (`createdByOrganizationId`). 
Any teacher or coordinator in the organization can use any active TA in that 
organization — there is no per-user filtering of available TAs.

## Important Notes

- This is a shared package - changes affect both apps
- After modifying this package, rebuild consuming apps
- Schema changes require either `db:push` or `db:generate` + `db:migrate`
- Better Auth tables are defined in `src/db/schema/auth.ts`
- Application tables are defined in `src/db/schema/app.ts`

## Related Documentation

- Database schema: `src/db/CLAUDE.md`
- Auth configuration: `src/auth/CLAUDE.md`
