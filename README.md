<div align="center">

# MiMotion

[![Next.js](https://img.shields.io/badge/Next.js-15-000000.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
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
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (base-ui) |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Auth | JWT (jose) + bcryptjs + HttpOnly Cookie |
| Encryption | AES-256-GCM for Xiaomi token storage |
| Scheduler | node-cron (Asia/Shanghai timezone) |
| Push | Bark + Telegram Bot |
| i18n | next-intl |

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/mimotion.git
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
ADMIN_PASSWORD=password
```

> **Important**: `ENCRYPTION_KEY` and `JWT_SECRET` must be 64-character hex strings. Changing `ENCRYPTION_KEY` will make existing encrypted Xiaomi tokens unreadable.

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
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run db:studio    # Drizzle Studio visual database manager
npm run db:push      # Sync schema to database
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
    (auth)/login/          # Login/Register
    (dashboard)/           # Main area (auth required)
      dashboard/           # Dashboard & logs
      xiaomi/              # Xiaomi account management
      schedules/           # Schedule management
      settings/            # User settings
      invite/              # Invite codes (admin)
      admin/               # User management (admin)
  api/                     # API routes
components/
  ui/                      # shadcn/ui components
lib/
  db/schema.ts             # Database schema (5 tables)
  auth.ts                  # JWT + password utilities
  crypto.ts                # AES-256-GCM encrypt/decrypt
  scheduler.ts             # Cron scheduler
  xiaomi/auth.ts           # Xiaomi/Zepp login
  xiaomi/client.ts         # Step submission API
  bark.ts / telegram.ts    # Push services
messages/
  zh.json / en.json        # i18n translation files
```

## Database

SQLite + Drizzle ORM, 5 tables:

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

After modifying the schema, run `npm run db:push` to sync.

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

### Docker

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
  mimotion
```

## Security

- Xiaomi tokens encrypted with AES-256-GCM; encryption key never stored in the database
- User passwords hashed with bcrypt
- JWT stored in HttpOnly cookies to prevent XSS
- All API routes require authentication; admin routes additionally verify `isAdmin`
- Account data isolated per user; cross-user access is not possible

## License

[WTFPL](http://www.wtfpl.net/) — Do What The Fuck You Want To Public License
