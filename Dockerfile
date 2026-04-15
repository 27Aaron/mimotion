FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
RUN npm install
COPY . .

ENV DATABASE_URL=/tmp/dummy.db
RUN npm run db:push || true
RUN npm run build

FROM base AS cleaner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/lib/db ./lib/db
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN rm -rf node_modules/typescript \
    && rm -rf node_modules/@img/sharp-linux-x64 \
    && rm -rf node_modules/@img/sharp-win32-x64 \
    && rm -rf node_modules/@img/sharp-darwin-x64 \
    && rm -rf node_modules/@img/sharp-darwin-arm64 \
    && rm -rf node_modules/caniuse-lite \
    && rm -rf node_modules/better-sqlite3/prebuilds/win32-* \
    && rm -rf node_modules/better-sqlite3/prebuilds/darwin-* \
    && rm -rf node_modules/better-sqlite3/deps \
    && rm -rf node_modules/better-sqlite3/build/Debug \
    && find node_modules -name "*.ts" -delete \
    && find node_modules -name "*.md" -delete \
    && find node_modules -name "*.d.ts" -delete \
    && find node_modules -name "LICENSE*" -delete \
    && find node_modules -name "CHANGELOG*" -delete

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libstdc++ su-exec

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=cleaner /app ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && mkdir -p data && chown nextjs:nodejs data

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/docker-entrypoint.sh"]
