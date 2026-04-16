FROM node:22-slim AS base

# Install build dependencies for native modules
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# Build Next.js
RUN npm run build

# Clean up dev-only files and unnecessary native bindings
FROM base AS cleaner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts

# Keep only what's needed at runtime
# - better-sqlite3: native binding for linux (glibc)
# - bcryptjs: pure JS, no native deps
# Remove: sharp (not used), typescript, type definitions, markdown, LICENSE files
RUN rm -rf node_modules/@img \
    node_modules/caniuse-lite \
    node_modules/typescript \
    node_modules/*/LICENSE* \
    node_modules/*/CHANGELOG* \
    node_modules/.cache \
    && find node_modules -name "*.ts" -delete \
    && find node_modules -name "*.md" -delete \
    && find node_modules -name "*.d.ts" -delete 2>/dev/null || true

# Runtime stage
FROM base AS runner
WORKDIR /app

# Install gosu for privilege dropping
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy cleaned node_modules and app files
COPY --from=cleaner --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=cleaner --chown=nextjs:nodejs /app ./

# Copy and setup entrypoint
COPY --chown=nextjs:nodejs docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/docker-entrypoint.sh"]
