# syntax=docker/dockerfile:1.7
#
# TACO-IDE Web (Next.js 16, standalone) — build context MUST be the repo root:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://taco.example.edu -t taco-web .
#
# IMPORTANT: NEXT_PUBLIC_API_URL is inlined into the client bundle at BUILD time.
# Setting it at `docker run` has NO effect — pass it as --build-arg (compose does
# this via build.args). To change the API origin you must rebuild the web image.
#
# Requires `output: "standalone"` + `outputFileTracingRoot` in next.config.mjs
# (already configured). The web image needs NO database/LLM/auth secrets — it is
# a pure client of the API; only NEXT_PUBLIC_API_URL matters, at build time.

ARG NEXT_PUBLIC_API_URL=http://localhost:4000

# =============================================================================
# Stage 1: deps — install the FULL workspace dependency tree (all workspace
# package.json files copied so npm hoists deterministically; this avoids
# Next's TS check failing to find @types/* at build time).
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
# Stage 2: builder — next build -> apps/web/.next/standalone. Bring the whole
# installed tree from deps, then overlay source.
# =============================================================================
FROM node:22-alpine AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

COPY --from=deps /repo ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN npm run build --workspace=apps/web

# =============================================================================
# Stage 3: runner — minimal standalone Next.js server
# =============================================================================
FROM node:22-alpine AS runner
RUN adduser -S -u 1001 app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# HOSTNAME=0.0.0.0 is required for the standalone server to bind all interfaces.
ENV HOSTNAME=0.0.0.0
ENV PORT=4001

# The standalone tree (traced from the monorepo root) contains apps/web/server.js
# plus a minimal node_modules. Static assets and public/ are NOT included and
# must be copied alongside it.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

USER app
EXPOSE 4001

CMD ["node", "apps/web/server.js"]
