# --- Dependencies ---
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Runtime ---
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

# Standalone output (contains server.js + all needed deps)
COPY --from=builder --chown=appuser:nodejs /app/.next/standalone ./
# Static assets not included in standalone
COPY --from=builder --chown=appuser:nodejs /app/.next/static ./.next/static
# Init script for DB + admin user
COPY --from=builder --chown=appuser:nodejs /app/scripts/init-db.js ./scripts/init-db.js

USER appuser

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create data dir, init DB, then start server
CMD ["sh", "-c", "mkdir -p \"$(dirname \"${DATABASE_URL:-./data/mimotion.db}\")\" && node scripts/init-db.js && node server.js"]
