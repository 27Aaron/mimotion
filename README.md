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

## Docker

```bash
docker compose up -d --build
```

The database is mounted at `./data/mimotion.db`. Keep `ENCRYPTION_KEY` safe and stable; changing it makes existing encrypted credentials unreadable.
