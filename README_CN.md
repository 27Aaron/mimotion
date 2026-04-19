<div align="center">

# MiMotion

[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57.svg?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-WTFPL-FF4136.svg)](http://www.wtfpl.net/)

**小米运动自动刷步服务 — 多账号 · 定时任务 · 推送通知**

English | [中文](README_CN.md)

</div>

小米运动自动刷步服务。绑定小米账号后，通过 Cron 定时随机写入步数，支持多账号、多任务、推送通知（Bark / Telegram）。

## 功能特性

- **多账号管理** — 一个用户可绑定多个小米/Zepp 账号，独立管理
- **定时刷步** — Cron 表达式自定义执行时间，随机步数范围 `[min, max]`
- **自动重登录** — Token 过期后自动使用 loginToken 刷新，loginToken 失效则用密码重登录，全链路加密存储
- **推送通知** — 支持 Bark 和 Telegram Bot，成功/失败实时推送
- **邀请码注册** — 管理员生成邀请码控制注册准入
- **中英双语** — next-intl 国际化支持
- **深色模式** — 亮/暗主题切换
- **管理后台** — 用户管理、邀请码管理、密码重置

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript 6 |
| 样式 | Tailwind CSS v4 + shadcn/ui (base-ui) |
| 数据库 | SQLite (better-sqlite3) + Drizzle ORM |
| 认证 | JWT (jose) + bcryptjs + HttpOnly Cookie |
| 加密 | AES-256-GCM（Xiaomi token 加密存储） |
| 调度 | node-cron (Asia/Shanghai 时区) |
| 推送 | Bark + Telegram Bot |
| 国际化 | next-intl |

## 快速开始

### 环境要求

- Node.js >= 22
- npm >= 9

### 安装

```bash
# 克隆项目
git clone https://github.com/27aaron/mimotion.git
cd mimotion

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
```

### 配置环境变量

编辑 `.env` 文件：

```env
# 数据库路径
DATABASE_URL=./data/mimotion.db

# 加密密钥（32 字节 hex，64 字符）— 生成方式: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-char-hex-key

# JWT 密钥（32 字节 hex，64 字符）— 生成方式同上
JWT_SECRET=your-64-char-hex-secret

# 初始管理员账号（仅首次初始化有效）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password
```

> **重要**: `ENCRYPTION_KEY` 和 `JWT_SECRET` 必须是 64 字符的十六进制字符串。修改 `ENCRYPTION_KEY` 会导致已加密的小米 Token 无法解密。

### 启动

```bash
# 开发模式（自动初始化数据库和管理员）
npm run dev

# 或分步执行
npm run setup    # 初始化数据库 + 创建管理员
npm run dev      # 启动开发服务器
```

访问 `http://localhost:3000`，使用 `.env` 中配置的管理员账号登录。

### 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run start        # 生产运行
npm run db:studio    # Drizzle Studio 可视化管理数据库
npm run db:push      # 同步 Schema 到数据库
npm run db:init-admin # 创建/重置管理员
```

## 使用流程

1. **管理员登录** — 使用初始管理员账号登录
2. **生成邀请码** — 在「邀请码」页面生成邀请码，分享给用户
3. **用户注册** — 用户通过邀请码注册账号
4. **绑定小米账号** — 在「小米账号」页面添加小米/Zepp 账号（输入账号和密码，系统自动登录并加密存储 Token）
5. **创建定时任务** — 在「定时任务」页面创建刷步任务，选择账号、设置 Cron 时间和步数范围
6. **查看执行记录** — 在「控制台」查看执行日志和统计信息
7. **配置推送**（可选） — 在「设置」页面配置 Bark URL 或 Telegram Bot Token

## 项目结构

```
app/
  [locale]/
    (auth)/login/          # 登录/注册页
    (dashboard)/           # 主功能区（需登录）
      dashboard/           # 控制台
      xiaomi/              # 小米账号管理
      schedules/           # 定时任务管理
      settings/            # 用户设置
      invite/              # 邀请码管理 (admin)
      admin/               # 用户管理 (admin)
  api/                     # API 路由
components/
  ui/                      # shadcn/ui 组件
lib/
  db/schema.ts             # 数据库 Schema（5 张表）
  auth.ts                  # JWT + 密码工具
  crypto.ts                # AES-256-GCM 加解密
  rate-limit.ts            # 内存速率限制器
  scheduler.ts             # Cron 调度执行器
  xiaomi/auth.ts           # 小米/Zepp 登录
  xiaomi/client.ts         # 提交步数 API
  bark.ts / telegram.ts    # 推送服务
messages/
  zh.json / en.json        # 国际化翻译文件
```

## 数据库

SQLite + Drizzle ORM，5 张表：

```
users ──1:N── xiaomi_accounts ──1:N── schedules ──1:N── run_logs
  │
  └──1:N── invite_codes
```

- **users** — 用户、推送配置
- **invite_codes** — 邀请码（注册准入控制）
- **xiaomi_accounts** — 小米账号（Token 加密存储）
- **schedules** — 定时任务（Cron + 步数范围）
- **run_logs** — 执行日志

Schema 修改后运行 `npm run db:push` 同步。

## 部署

### Node.js 部署

```bash
npm run build
npm run start
```

建议使用 PM2 管理进程：

```bash
npm install -g pm2
pm2 start npm --name mimotion -- start
```

### Nix / NixOS 部署

在 flake inputs 中添加：

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
    encryptionKey = "你的64位hex密钥";    # 或使用 environmentFile
    jwtSecret = "你的64位hex密钥";        # 或使用 environmentFile
    # environmentFile = "/run/secrets/mimotion.env";  # 推荐用于密钥管理
  };
}
```

#### Home Manager

**Linux**（systemd 用户服务）：

```nix
{
  imports = [ inputs.mimotion.homeManagerModules.default ];

  services.mimotion = {
    enable = true;
    encryptionKey = "你的64位hex密钥";
    jwtSecret = "你的64位hex密钥";
  };
}
```

**macOS**（launchd agent）—— 配置相同，Home Manager 自动识别平台。

#### 开发环境

```bash
nix develop
```

> 支持 `x86_64-linux`、`aarch64-linux`、`x86_64-darwin`、`aarch64-darwin` 四平台。

### Docker 部署

使用 docker compose（推荐）：

```bash
# 克隆项目
git clone https://github.com/27aaron/mimotion.git
cd mimotion

# 设置必需的环境变量
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 构建并启动
docker compose up -d
```

或手动构建：

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

> 支持 `linux/amd64` 和 `linux/arm64` 双架构，Docker 自动匹配当前机器架构。

## 安全说明

- Xiaomi Token 使用 AES-256-GCM 加密存储，密钥不写入数据库
- 用户密码使用 bcrypt 哈希存储（cost 12）
- JWT 存储在 HttpOnly + Secure Cookie 中，防止 XSS 窃取
- 登录限流（10 次/15 分钟）、注册限流（5 次/小时）
- API 路由统一鉴权，管理接口额外校验 `isAdmin`
- 所有小米账号数据按用户隔离，跨用户不可访问
- 输入校验：UUID 格式验证、步数上限、Cron 格式检查
- 安全响应头：X-Frame-Options、X-Content-Type-Options、Referrer-Policy
- 密码策略：至少 8 位，必须包含字母和数字
- 密码修改后自动清除会话，强制重新登录

## 许可证

[WTFPL](http://www.wtfpl.net/) — Do What The Fuck You Want To Public License
