<div align="center">

# MiMotion

**Automated Xiaomi/Zepp Step Counter — Multi-Account · Scheduled Tasks · Push Notifications**

English | [中文](README_CN.md)

[![CI](https://github.com/27Aaron/mimotion/actions/workflows/check.yml/badge.svg)](https://github.com/27Aaron/mimotion/actions/workflows/check.yml)
[![Release](https://img.shields.io/github/v/release/27Aaron/mimotion)](https://github.com/27Aaron/mimotion/releases)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2F27Aaron%2Fmimotion-2496ED?logo=docker&logoColor=white)](https://github.com/27Aaron/mimotion/pkgs/container/mimotion)
[![Rust Version](https://img.shields.io/badge/rust-1.96%2B-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)

</div>

MiMotion is a self-hosted Xiaomi/Zepp step counter service. It supports multiple accounts, Cron schedules, automatic re-login, and Bark / Telegram notifications.

## Features

- Manage multiple Xiaomi / Zepp accounts
- Write a random step count within a configured range on a Cron schedule
- Automatically re-login with `loginToken` and password when a token expires
- Optional mainland China workday calendar with holiday and make-up workday support
- Bark / Telegram push notifications
- Invite-code registration, admin panel, Chinese/English, and dark mode
- SQLite storage with durable execution logs

## Quick start

Docker Compose is the recommended deployment method:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```env
ENCRYPTION_KEY=64-character-hex-key
JWT_SECRET=64-character-hex-secret
ADMIN_PASSWORD=replace-with-a-strong-password
```

Set `AUTH_COOKIE_SECURE=false` for local HTTP access. Keep it `true` when serving MiMotion over HTTPS.

```bash
docker compose up -d
```

Open <http://localhost:3000> and sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. The database and runtime data are stored in `./data`. Keep `ENCRYPTION_KEY` safe and stable; changing it makes existing encrypted credentials unreadable.

You can also run the published image directly:

```bash
docker run -d --name mimotion -p 3000:3000 -v ./data:/var/lib/mimotion \
  -e ENCRYPTION_KEY=<64-char-hex-key> \
  -e JWT_SECRET=<64-char-hex-secret> \
  -e ADMIN_PASSWORD=<strong-password> \
  -e AUTH_COOKIE_SECURE=false \
  ghcr.io/27Aaron/mimotion:latest
```

## Documentation

- [Architecture, project conventions, and local development](docs/architecture.md)
- [Rust single-binary build and runtime](docs/rust-single-binary.md)
