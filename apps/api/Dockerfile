# syntax=docker/dockerfile:1.7
#
# TACO-IDE API (Fastify) — build context MUST be the repo root:
#   docker build -f apps/api/Dockerfile --target runner -t taco-api .
#
# Design: the API runs straight from TypeScript source via `tsx` (the exact same
# way `npm run dev` does), with NO tsup/bundling step. Reasons:
#   * @repo/infra is a workspace package shipped as raw .ts (its "exports" point
#     at ./src/*.ts), so a tsx ESM loader is required at runtime regardless.
#   * Skipping tsup also avoids rollup's platform-native optional dependency,
#     which `npm ci` fails to install from a lockfile generated on another OS
#     (npm optional-deps bug npm/cli#4828).
# tsx uses esbuild for on-the-fly transpile; cold start costs a couple of extra
# seconds, irrelevant for a long-running server.
#
# Targets:
#   runner  -> the long-running API server (default)
#   migrate -> one-shot job: drizzle-kit migrate + prod seed (see compose)

# =============================================================================
# Stage 1: deps — install the FULL workspace dependency tree. All workspace
# package.json files are copied so npm hoists deterministically.
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/infra/package.json ./packages/infra/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# =============================================================================
# Stage 2: runner — API server, run from source via tsx.
# `COPY --from=deps /repo ./` brings the whole installed tree (root + any
# per-workspace node_modules npm did not hoist, e.g. better-auth under
# packages/infra), then source is overlaid on top.
# =============================================================================
FROM node:22-alpine AS runner
# pandoc: converts non-PDF Knowledge Base uploads
# (apps/api/src/services/document-parser.ts shells out to `pandoc`). PDFs are
# parsed in-process by pdf-parse (no binary).
RUN apk add --no-cache pandoc && adduser -S -u 1001 app
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps /repo ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Runtime writes by the non-root `app` user:
#  - uploads/ (Knowledge Base files; mount a volume here in compose)
#  - apps/api/src/swagger.yaml (the server re-exports the OpenAPI spec on boot)
RUN mkdir -p /repo/uploads/documents \
    && chown -R app /repo/uploads /repo/apps/api/src

USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
    CMD wget -qO- http://127.0.0.1:4000/v1/status >/dev/null 2>&1 || exit 1

CMD ["node", "--import", "tsx/esm", "apps/api/src/index.ts"]

# =============================================================================
# Stage 3: migrate — one-shot DB provisioning (drizzle migrations + prod seed).
# Runs to completion before the API starts. drizzle-kit/tsx come from node_modules;
# the drizzle.config, the drizzle/ SQL folder and the schema live under
# packages/infra. The default command runs the PROD-safe seed; compose.yaml
# overrides it for local (adds the dev fixtures).
# =============================================================================
FROM node:22-alpine AS migrate
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=deps /repo ./
COPY packages/ ./packages/

WORKDIR /repo/packages/infra
CMD ["sh", "-c", "npx drizzle-kit migrate --config ./drizzle.config.ts && npx tsx src/db/seeds/prod.ts"]
