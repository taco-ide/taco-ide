# TACO-IDE

An intelligent educational platform designed to help teachers create and manage Python programming exercises with AI support.

## Architecture

This is a Turborepo monorepo with the following structure:

```
taco-ide/
├── apps/
│   ├── api/          # Fastify backend API
│   ├── web/          # Next.js frontend
│   └── agents/       # Python ADK AI agents (student tutor + teacher assistant)
├── packages/
│   ├── infra/        # Shared infrastructure (DB, Auth, Docker)
│   ├── types/        # Shared TypeScript types
│   ├── eslint-config/
│   ├── typescript-config/
│   └── ui/           # Shared UI components
└── docs/             # Documentation
```

## Tech Stack

### Backend (`apps/api`)
- **Fastify 5** - High-performance web framework
- **Zod** - Schema validation with type inference
- **Swagger/OpenAPI** - Auto-generated API documentation
- **Better Auth** - Authentication system
- **Kubb** - Code generation for types and React Query hooks

### Frontend (`apps/web`)
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Zustand** - State management
- **React Query** - Server state management

### AI Agents (`apps/agents`)
- **Google ADK** - Agent Development Kit with LiteLLM
- **FastAPI** - Python async HTTP framework
- **asyncpg** - Direct PostgreSQL access for agent tools
- **Piston API** - Sandboxed code execution

### Infrastructure (`packages/infra`)
- **Drizzle ORM** - Type-safe PostgreSQL ORM
- **Better Auth** - Email/password authentication
- **Resend** - Email delivery service
- **Docker** - PostgreSQL container

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+
- Docker & Docker Compose
- npm 11+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/taco-ide.git
cd taco-ide

# Install Node dependencies
npm install

# Set up Python agents
cd apps/agents
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ../..
```

### Environment Setup

Create environment files for both applications:

**1. API Environment (`apps/api/.env.development`):**

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taco_dev

# Better Auth (minimum 32 characters)
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3333

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:3000

# Email (optional - only if using Resend)
# RESEND_API_KEY=your-resend-api-key
# EMAIL_FROM=noreply@taco-ide.com
```

**2. Web Environment (`apps/web/.env.local`):**

```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3333
```

**3. Agents Environment (`apps/agents/.env`):**

```bash
# Database (must match apps/api/.env.development DATABASE_URL)
DATABASE_URL=

# LLM provider (OpenAI-compatible endpoint)
LLM_API_BASE=http://localhost:8000/v1
LLM_MODEL_NAME=my-model
LLM_API_KEY=your-key

# Agent service
AGENT_PORT=8888

# Code execution API
CODE_EXEC_API_URL=https://emkc.org/api/v2/piston/execute
```

> **Note:** The `.env.development`, `.env.local`, and `.env` files are gitignored. Make sure to create them before running the application.

### Database Setup

```bash
# Start PostgreSQL container
cd packages/infra
npm run services:up

# Apply migrations to database
npm run db:migrate

# Seed initial data (optional)
npm run db:seed

# (Optional) Open Drizzle Studio to view/manage data
npm run db:studio
```

### Running the Application

```bash
# From the root directory, start all apps in development mode
npm run dev

# Or start individually:
# API server (port 3333)
cd apps/api && npm run dev

# Web frontend (port 3000)
cd apps/web && npm run dev

# AI agents (port 8888)
cd apps/agents && npm run dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3333
- **API Docs**: http://localhost:3333/docs
- **Agents Health**: http://localhost:8888/health

### API Documentation

Once the API is running, access the Swagger documentation at:
- **Swagger UI**: http://localhost:3333/docs
- **OpenAPI JSON**: http://localhost:3333/docs/json

## Development Workflow

### Adding New API Endpoints

1. Create route files in `apps/api/src/http/routes/v1/`
2. Define Zod schemas for request/response
3. Register routes in `apps/api/src/http/routes/v1/index.ts`
4. Run `npm run kubb` to generate types and hooks

### Database Changes

1. Modify schema in `packages/infra/src/db/schema/`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply migration

### Code Generation

```bash
# In apps/api, regenerate types and hooks after API changes
npm run kubb
```

This generates:
- TypeScript types in `packages/types/kubb/`
- React Query hooks in `apps/web/src/kubb/hooks/`
- Zod schemas in `apps/api/src/gen/kubb/zod/`

## Scripts Reference

### Root
| Script | Description |
|--------|-------------|
| `npm run dev` | Start all apps in development |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all packages |

### packages/infra
| Script | Description |
|--------|-------------|
| `npm run services:up` | Start PostgreSQL container |
| `npm run services:stop` | Stop PostgreSQL container |
| `npm run services:down` | Stop and remove PostgreSQL container |
| `npm run db:generate` | Generate Drizzle migration |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed database |

### apps/api
| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run kubb` | Generate types and hooks |

### apps/web
| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Run production build |

### apps/agents
| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload (uvicorn) |
| `npm run start` | Run production server |
| `npm run lint` | Lint with ruff |

## Project Documentation

- [Backend API Guide](apps/api/CLAUDE.md)
- [Frontend Guide](apps/web/CLAUDE.md)
- [Architecture Document](docs/new-architecture.md)

## License

Private - All rights reserved
