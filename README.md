<div align="center">

# MiMotion

[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57.svg?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-WTFPL-FF4136.svg)](http://www.wtfpl.net/)

**Automated Xiaomi/Zepp Step Counter — Multi-Account · Scheduled Tasks · Push Notifications**

[中文](README_CN.md) | English

</div>

Automated Xiaomi/Zepp step counter service. Bind your Xiaomi account, set up cron jobs with random step ranges, and let it run. Supports multiple accounts, scheduled tasks, and push notifications (Bark / Telegram).

## Features

- **Multi-Account Management** — Bind multiple Xiaomi/Zepp accounts per user
- **Scheduled Steps** — Custom cron expressions with random step range `[min, max]`
- **Auto Re-login** — Three-tier credential chain: token → loginToken refresh → password re-login, all encrypted at rest
- **Push Notifications** — Bark and Telegram Bot integration with success/failure alerts
- **Invite-Code Registration** — Admin-controlled registration via invite codes
- **i18n** — Chinese and English via next-intl
- **Dark Mode** — Light/dark theme toggle
- **Admin Panel** — User management, invite code management, password reset

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript 6 |
| Styling | Tailwind CSS v4 + shadcn/ui (base-ui) |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Auth | JWT (jose) + bcryptjs + HttpOnly Cookie |
| Encryption | AES-256-GCM for Xiaomi token storage |
| Scheduler | node-cron (Asia/Shanghai timezone) |
| Push | Bark + Telegram Bot |
| i18n | next-intl |

## Getting Started

### Prerequisites

- Node.js >= 22
- npm >= 9

### Installation

```bash
# Clone the repo
git clone https://github.com/27aaron/mimotion.git
cd mimotion

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Configure Environment Variables

Edit `.env`:

```env
# Database path
DATABASE_URL=./data/mimotion.db

# Encryption key (32-byte hex, 64 chars) — Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-char-hex-key

# JWT secret (32-byte hex, 64 chars) — Generate the same way
JWT_SECRET=your-64-char-hex-secret

# Initial admin account (only effective on first setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password

# Keep true for HTTPS. Set false only when accessing directly over HTTP on a trusted LAN.
AUTH_COOKIE_SECURE=true

```

> **Important**: `ENCRYPTION_KEY` and `JWT_SECRET` must be 64-character hex strings. Persist `ENCRYPTION_KEY` and do not change it casually, or existing encrypted credentials will become unreadable.

### Start

```bash
# Development (auto-initializes database and admin)
npm run dev

# Or step by step
npm run setup    # Initialize database + create admin
npm run dev      # Start dev server
```

Visit `http://localhost:3000` and log in with the admin credentials from `.env`.

### Common Commands

```bash
npm run dev          # Development server + scheduler worker
npm run build        # Production build
npm run check        # Lint, type-check, test, and production build
npm run start        # Production web server + worker
npm run start:web    # Web only (split-process deployment)
npm run start:worker # Scheduler worker only
npm run db:studio    # Drizzle Studio visual database manager
npm run db:migrate   # Apply versioned migrations and initialize admin
npm run db:generate  # Generate a migration after schema changes
npm run db:init-admin # Create/reset admin account
```

## Usage

1. **Admin Login** — Sign in with the initial admin account
2. **Generate Invite Code** — Create invite codes on the "Invite Codes" page
3. **User Registration** — Users register with an invite code
4. **Bind Xiaomi Account** — Add Xiaomi/Zepp credentials on the "Accounts" page (auto-login, token encrypted and stored)
5. **Create Schedule** — Set up step tasks on the "Schedules" page — pick an account, cron time, and step range
6. **View Logs** — Check execution history and stats on the "Dashboard" page
7. **Configure Push** (optional) — Set up Bark URL or Telegram Bot on the "Settings" page

## Project Structure

```
app/
  [locale]/
    (auth)/                # Authentication route adapters
    (dashboard)/           # Authenticated route adapters
  api/                     # Thin Route Handler adapters
components/
  dashboard/               # Shared dashboard components
  layout/                  # Navigation, theme, and locale controls
  providers/               # Global React providers
  ui/                      # shadcn/ui components
features/
  */components/            # Feature-private components
  */screens/               # Page-level feature components
  */server/                # Server handlers and use cases
  */client.ts              # Typed browser API clients
  */contracts.ts           # Domain request validation
lib/
  auth/                    # JWT, passwords, registration, redirects
  db/                      # SQLite, schema, and ownership operations
  http/                    # Shared HTTP client
  notifications/           # Bark, Telegram, and notification secrets
  security/                # Encryption, rate limiting, URL safety
  scheduling/              # Cron, execution queue, and orchestration
  xiaomi/                  # Xiaomi/Zepp auth and step protocol
tests/unit/                # Unit tests
worker/main.ts             # Dedicated scheduler worker entry point
drizzle/migrations/        # Versioned SQLite migrations
messages/
  zh.json / en.json        # i18n translation files
```

See the [code architecture guide](docs/architecture.md) for dependency and file-placement rules.

## Database

SQLite + Drizzle ORM with 5 business tables plus the internal `run_executions` and `rate_limits` infrastructure tables:

```
users ──1:N── xiaomi_accounts ──1:N── schedules ──1:N── run_logs
  │
  └──1:N── invite_codes
```

- **users** — Users and push notification config
- **invite_codes** — Registration access control
- **xiaomi_accounts** — Xiaomi accounts (encrypted token storage)
- **schedules** — Scheduled tasks (cron + step range)
- **run_logs** — Execution logs

After modifying the schema, run `npm run db:generate`. Startup automatically applies pending migrations in place without rebuilding the SQLite database.

Scheduling runs in a dedicated worker process. `MIMOTION_ROLE=all` starts both web and worker by default. For split-process deployment, start one process with `MIMOTION_ROLE=web` and another with `MIMOTION_ROLE=worker`, both pointing at the same local SQLite database file.

## Deployment

### Node.js

```bash
npm run build
npm run start
```

Recommended: use PM2 for process management:

```bash
npm install -g pm2
pm2 start npm --name mimotion -- start
```

### Nix / NixOS

Add the flake to your inputs:

```nix
inputs.mimotion.url = "github:27Aaron/mimotion";
```

#### NixOS Module

```nix
{
  imports = [ inputs.mimotion.nixosModules.default ];

  services.mimotion = {
    enable = true;
    port = 3000;
    # Secrets (use environmentFile for production)
    environmentFile = "/run/secrets/mimotion.env";
    # Or set directly (WARNING: stored in /nix store, world-readable)
    # encryptionKey = "your-64-char-hex-key";
    # jwtSecret = "your-64-char-hex-secret";
  };
}
```

The `environmentFile` should contain:

```env
ENCRYPTION_KEY=your-64-char-hex-key
JWT_SECRET=your-64-char-hex-secret
ADMIN_PASSWORD=a-strong-password-for-first-start
AUTH_COOKIE_SECURE=true
```

Generate keys: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**NixOS options:**

| Option | Default | Description |
|--------|---------|-------------|
| `enable` | `false` | Enable the service |
| `package` | flake package | MiMotion package |
| `port` | `3000` | Listening port |
| `dataDir` | `/var/lib/mimotion` | Database and runtime data directory |
| `encryptionKey` | `null` | AES-256-GCM key (64-char hex). Prefer `environmentFile` |
| `jwtSecret` | `null` | JWT secret (64-char hex). Prefer `environmentFile` |
| `adminUsername` | `"admin"` | Initial admin username |
| `adminPassword` | `"password"` | Initial admin password; production first start must override it |
| `user` / `group` | `"mimotion"` | Service user/group |
| `environment` | `{ }` | Extra environment variables |
| `environmentFile` | `null` | File with secrets (KEY=VALUE format) |

The service runs as a systemd service with security hardening (`ProtectSystem`, `PrivateTmp`, `NoNewPrivileges`).

#### Home Manager

**Linux** (systemd user service):

```nix
{
  imports = [ inputs.mimotion.homeManagerModules.default ];

  services.mimotion = {
    enable = true;
    environmentFile = "/path/to/secrets.env";
  };
}
```

**macOS** (launchd agent) — same config, Home Manager auto-detects the platform and uses launchd instead of systemd.

**Home Manager options:**

| Option | Default | Description |
|--------|---------|-------------|
| `enable` | `false` | Enable the service |
| `package` | flake package | MiMotion package |
| `port` | `3000` | Listening port |
| `dataDir` | `~/.local/share/mimotion` | Database directory |
| `encryptionKey` | `null` | AES-256-GCM key. Prefer `environmentFile` |
| `jwtSecret` | `null` | JWT secret. Prefer `environmentFile` |
| `adminUsername` | `"admin"` | Initial admin username |
| `adminPassword` | `"password"` | Initial admin password; production first start must override it |
| `environment` | `{ }` | Extra environment variables |
| `environmentFile` | `null` | File with secrets (KEY=VALUE format) |

#### Dev Shell

```bash
nix develop
```

> Supports `x86_64-linux`, `aarch64-linux`, `x86_64-darwin`, `aarch64-darwin`.

### Docker

Using docker compose (recommended):

```bash
# Clone and configure
git clone https://github.com/27aaron/mimotion.git
cd mimotion

# Set required environment variables
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# Direct HTTP access on a trusted LAN only:
# export AUTH_COOKIE_SECURE=false

# Build and start
docker compose up -d
```

Or build manually:

```bash
docker build -t mimotion .
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e DATABASE_URL=/app/data/mimotion.db \
  -e ENCRYPTION_KEY=your-key \
  -e JWT_SECRET=your-secret \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=your-password \
  -e AUTH_COOKIE_SECURE=true \
  mimotion
```

> Supports `linux/amd64` and `linux/arm64`. Docker auto-selects the correct architecture.

## Security

- Xiaomi tokens encrypted with AES-256-GCM; encryption key never stored in the database
- User passwords hashed with bcrypt (cost 12)
- JWT stored in HttpOnly cookies; production uses Secure cookies by default, with an explicit opt-out for trusted HTTP-only LAN deployments
- API rate limiting on login (10 req/15min) and registration (5 req/hour)
- All API routes require authentication; admin routes additionally verify `isAdmin`
- Account data isolated per user; cross-user access is not possible
- Input validation with UUID format checks, step bounds, and cron format verification
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Password policy: minimum 8 characters, must contain letters and numbers
- Session invalidated on password change

## License

[WTFPL](http://www.wtfpl.net/) — Do What The Fuck You Want To Public License
