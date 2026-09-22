<div align="center">

# MiMotion

**小米运动自动刷步服务 — 多账号 · 定时任务 · 推送通知**

[English](README.md) | 中文

[![CI](https://github.com/27Aaron/mimotion/actions/workflows/check.yml/badge.svg)](https://github.com/27Aaron/mimotion/actions/workflows/check.yml)
[![Release](https://img.shields.io/github/v/release/27Aaron/mimotion)](https://github.com/27Aaron/mimotion/releases)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2F27Aaron%2Fmimotion-2496ED?logo=docker&logoColor=white)](https://github.com/27Aaron/mimotion/pkgs/container/mimotion)
[![Rust Version](https://img.shields.io/badge/rust-1.96%2B-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)

</div>

MiMotion 是一个自托管的小米运动 / Zepp 自动刷步服务。它支持多个账号、Cron 定时任务、自动重登录，以及 Bark 和 Telegram 通知。

## 功能

- 管理多个 Xiaomi / Zepp 账号
- 按 Cron 定时任务随机写入指定范围的步数
- Token 过期后自动使用 loginToken 和密码重登录
- 可选中国大陆工作日历，支持节假日和调休
- Bark / Telegram 推送通知
- 邀请码注册、管理员后台、中英文和暗色模式
- SQLite 数据库和持久化执行日志

## 快速开始

推荐使用 Docker Compose：

```bash
cp .env.example .env
```

编辑 `.env`，至少设置以下变量：

```env
ENCRYPTION_KEY=64位十六进制密钥
JWT_SECRET=64位十六进制密钥
ADMIN_PASSWORD=请设置强密码
```

本地通过 HTTP 访问时，将 `AUTH_COOKIE_SECURE` 设为 `false`；使用 HTTPS 时保持为 `true`。

```bash
docker compose up -d
```

打开 <http://localhost:3000>，使用 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录。数据库和其他运行数据保存在 `./data`。`ENCRYPTION_KEY` 必须长期保存，更换后已有的加密凭据将无法解密。

也可以直接运行已发布的镜像：

```bash
docker run -d --name mimotion -p 3000:3000 -v ./data:/var/lib/mimotion \
  -e ENCRYPTION_KEY=<64位十六进制密钥> \
  -e JWT_SECRET=<64位十六进制密钥> \
  -e ADMIN_PASSWORD=<强密码> \
  -e AUTH_COOKIE_SECURE=false \
  ghcr.io/27Aaron/mimotion:latest
```

## 文档

- [代码架构、目录约定与本地开发](docs/architecture.md)
- [Rust 单二进制构建与运行](docs/rust-single-binary.md)
