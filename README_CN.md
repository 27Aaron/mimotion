<div align="center">

# MiMotion

**小米运动自动刷步服务 — 多账号 · 定时任务 · 推送通知**

[English](README.md) | 中文

</div>

MiMotion 是一个自托管的小米运动 / Zepp 自动刷步服务，支持多账号、Cron 定时任务、自动重登录以及 Bark / Telegram 通知。

## 当前架构

- `frontend/`：Vite + React 前端，保留原有视觉设计和交互页面。
- `backend/`：Rust + Axum + SQLx + Tokio，负责 API、SQLite、调度器、通知和 Xiaomi 协议。

Rust 后端会把 `frontend/dist` 嵌入最终二进制，生产环境只需要运行一个文件，不需要 Node.js。

## 快速开始

### 环境要求

- Node.js >= 22（仅用于构建前端）
- Rust >= 1.96

### 配置

复制并编辑环境变量：

```bash
cp .env.example .env
```

至少需要设置：

```env
DATABASE_URL=./data/mimotion.db
ENCRYPTION_KEY=64位十六进制密钥
JWT_SECRET=64位十六进制密钥
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请设置强密码
MIMOTION_HOST=0.0.0.0
PORT=3000
```

### 开发和构建

```bash
npm install
npm run dev:frontend

# 构建前端并生成 Rust 单二进制
npm run build:single

# 启动
npm run start:single
```

开发前端默认运行在 `http://localhost:5173`，API 请求代理到 `http://localhost:3000`。

## 功能

- 多个 Xiaomi / Zepp 账号
- 随机步数范围和 Cron 定时任务
- Token → loginToken → 密码的自动重登录链路
- Bark / Telegram 推送
- 邀请码注册和管理员后台
- 中英文语言包、暗色模式
- SQLite 原地迁移和持久化执行日志

## 目录结构

详细目录约定见 [代码架构说明](docs/architecture.md)，单二进制部署说明见 [Rust 单二进制运行架构](docs/rust-single-binary.md)。

```text
frontend/
  src/app/                  # SPA 入口
  src/components/           # 共享 UI 和布局
  src/features/             # 业务页面和浏览器端 API
  src/i18n/messages/        # zh/en 语言包
  src/platform/             # 浏览器导航和平台适配
  src/styles/               # 全局样式

backend/
  migrations/               # SQLite 迁移
  src/web/                  # Axum API
  src/storage/              # 数据库和模型
  src/scheduling/           # Cron 和调度器
  src/xiaomi/               # Xiaomi/Zepp 协议
  src/notifications/        # Bark / Telegram
```

## 发布

推送 `v*` tag 会触发 GitHub Actions 一次性完成构建和发布：

- 四个平台的静态二进制（`linux/amd64`、`linux/arm64`、macOS arm64、macOS x86_64），附在 GitHub Release 并带校验和；
- 多架构 Docker 镜像（linux/amd64 + linux/arm64），推送至 `ghcr.io/27Aaron/mimotion`，以版本号打 tag。

## Docker

直接使用发布好的镜像：

```bash
docker run -d --name mimotion -p 3000:3000 -v ./data:/var/lib/mimotion \
  -e ENCRYPTION_KEY=<64位十六进制> -e JWT_SECRET=<64位十六进制> \
  -e ADMIN_PASSWORD=<强密码> \
  ghcr.io/27Aaron/mimotion:latest
```

或者本地构建：

```bash
docker compose up -d --build
```

数据库默认挂载到 `./data/mimotion.db`。`ENCRYPTION_KEY` 必须长期保存，不能随意更换，否则已有加密凭据无法解密。
