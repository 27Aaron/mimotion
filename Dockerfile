# syntax=docker/dockerfile:1

# --- Dependencies ---
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN --mount=type=cache,target=/root/.npm \
    npm install --global npm@11.16.0 --no-audit --no-fund
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# --- Build ---
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# --- Runtime ---
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends gosu && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

# Standalone output (contains server.js + all needed deps)
COPY --from=builder --chown=appuser:nodejs /app/.next/standalone ./
# Static assets not included in standalone
COPY --from=builder --chown=appuser:nodejs /app/.next/static ./.next/static
# Init script for DB + admin user
COPY --from=builder --chown=appuser:nodejs /app/scripts/init-db.mjs ./scripts/init-db.mjs
COPY --from=builder --chown=appuser:nodejs /app/scripts/start.mjs ./scripts/start.mjs
COPY --from=builder --chown=appuser:nodejs /app/drizzle/migrations ./drizzle/migrations
COPY --from=builder --chown=appuser:nodejs /app/.worker ./.worker
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV MIMOTION_HOST="0.0.0.0"

# Prepare the bind-mounted database directory as root, then drop privileges.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "scripts/start.mjs"]
