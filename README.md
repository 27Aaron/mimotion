<div align="center">

# MiMotion

**Automated Xiaomi/Zepp Step Counter — Multi-Account · Scheduled Tasks · Push Notifications**

English | [中文](README_CN.md)

</div>

MiMotion is a self-hosted Xiaomi/Zepp step counter service with multi-account support, scheduled tasks, automatic re-login, and Bark / Telegram notifications.

## Architecture

- `frontend/`: Vite + React frontend, preserving the original visual design and screens.
- `backend/`: Rust + Axum + SQLx + Tokio API, SQLite storage, scheduler, notifications, and Xiaomi protocol.

The Rust server embeds `frontend/dist` into the final executable. Production only needs one binary and does not require Node.js.

## Quick start

### Requirements

- Node.js >= 22 (frontend build only)
- Rust >= 1.96

### Configuration

```bash
cp .env.example .env
```

Set at least:

```env
DATABASE_URL=./data/mimotion.db
ENCRYPTION_KEY=64-character-hex-key
JWT_SECRET=64-character-hex-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
MIMOTION_HOST=0.0.0.0
PORT=3000
```

### Development and build

```bash
npm install
npm run dev:frontend

# Build the frontend and the Rust single binary
npm run build:single

# Start
npm run start:single
```

The frontend dev server runs at `http://localhost:5173` and proxies API requests to `http://localhost:3000`.

## Features

- Multiple Xiaomi / Zepp accounts
- Random step ranges and Cron schedules
- Token → loginToken → password automatic re-login chain
- Bark / Telegram notifications
- Invite-code registration and admin panel
- Chinese/English language packs and dark mode
- SQLite in-place migrations and durable execution logs

## Project layout

See [the architecture guide](docs/architecture.md) and [the Rust single-binary guide](docs/rust-single-binary.md).

```text
frontend/
  src/app/                  # SPA entry
  src/components/           # Shared UI and layout
  src/features/             # Feature screens and browser API clients
  src/i18n/messages/        # zh/en language packs
  src/platform/             # Browser navigation and platform adapters
  src/styles/               # Global styles

backend/
  migrations/               # SQLite migrations
  src/web/                  # Axum API
  src/storage/              # Database and models
  src/scheduling/           # Cron and scheduler
  src/xiaomi/               # Xiaomi/Zepp protocol
  src/notifications/        # Bark / Telegram
```

## Releases

Pushing a `v*` tag triggers GitHub Actions to build and publish in one go:

- Static binaries (musl/glibc-free) for `linux/amd64`, `linux/arm64`, `macOS arm64` and `macOS x86_64`, attached to the GitHub Release with checksums;
- Multi-arch Docker images (linux/amd64 + linux/arm64) pushed to `ghcr.io/27Aaron/mimotion`, tagged with the version.

## Docker

Use the published image:

```bash
docker run -d --name mimotion -p 3000:3000 -v ./data:/var/lib/mimotion \
  -e ENCRYPTION_KEY=<64-char-hex> -e JWT_SECRET=<64-char-hex> \
  -e ADMIN_PASSWORD=<strong-password> \
  ghcr.io/27Aaron/mimotion:latest
```

Or build locally:

```bash
docker compose up -d --build
```

The database is mounted at `./data/mimotion.db`. Keep `ENCRYPTION_KEY` safe and stable; changing it makes existing encrypted credentials unreadable.

On Linux hosts, make the data directory writable by the container user (uid 10001) before first start:

```bash
mkdir -p data && sudo chown 10001:10001 data
```

macOS (Docker Desktop / OrbStack) needs no extra steps.
