# CLAUDE.md — MiMotion

## Project Overview

Xiaomi/Zepp 自动刷步服务。用户绑定小米账号后，通过 cron 定时随机写入步数，支持推送通知（Bark 等）。

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-ui) + next-themes (dark/light)
- **Icons**: lucide-react
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Auth**: JWT (jose) + bcryptjs + HttpOnly cookies
- **Encryption**: AES-256-GCM (Xiaomi token 存储)
- **Scheduler**: node-cron (Asia/Shanghai timezone)
- **Notifications**: Bark push service (可扩展)

## Commands

```bash
npm run dev          # 开发 (自动 db:push + init-admin)
npm run setup        # 初始化数据库和管理员
npm run build        # 生产构建
npm run db:push      # 推送 schema 到数据库
npm run db:studio    # Drizzle Studio 可视化
npm run db:init-admin # 创建初始管理员
```

## Project Structure

```
app/
  (auth)/login/            # 统一登录/注册页 (左右分栏，可切换)
  (dashboard)/             # 主功能区 (需登录)
    dashboard/             # 控制台 (统计概览 + 执行记录)
    xiaomi/                # 小米账号管理
    schedules/             # 定时任务管理
    settings/              # 用户设置
    invite/                # 邀请码管理 (admin)
    admin/                 # 用户管理 (admin)
  api/
    auth/[...action]/      # 登录/注册/登出/me
    xiaomi/                # 小米账号 CRUD
    schedules/             # 定时任务 CRUD
    user/settings/         # 用户设置
    invite/                # 邀请码 (admin)
    admin/users/           # 用户管理 CRUD (admin)
    cron/                  # 启动调度器
  globals.css              # Tailwind + shadcn 主题变量 (oklch)
  layout.tsx               # 根布局 + ThemeProvider
components/
  theme-provider.tsx       # next-themes 封装
  theme-toggle.tsx         # 亮/暗模式切换按钮
  ui/                      # shadcn/ui 组件 (card, table, dialog, button 等)
lib/
  db/schema.ts             # Drizzle schema (5 张表)
  db/index.ts              # 数据库连接
  utils.ts                 # cn() 工具函数 (shadcn)
  auth.ts                  # JWT + 密码工具
  crypto.ts                # AES-256-GCM 加解密
  bark.ts                  # Bark 推送
  scheduler.ts             # Cron 调度执行器
  xiaomi/auth.ts           # 小米/Zepp 两步登录
  xiaomi/client.ts         # 提交步数 API
scripts/
  init-admin.ts            # 初始化管理员脚本
```

## UI Architecture

- **shadcn/ui** 组件库，基于 `@base-ui/react`（非 Radix）
- Tailwind CSS v4，主题色通过 oklch CSS 变量定义（亮/暗两套）
- 主色调：翡翠绿 `oklch(0.596 0.145 163.2)`
- 统一页面结构：`text-2xl font-bold` 标题 + `text-muted-foreground` 描述 + 内容区
- 侧边栏：品牌 logo + 导航 + 用户信息区（邮箱 + 角色）
- 登录页：左右分栏（品牌介绍 + 切换式登录/注册表单）
- 所有页面支持 dark/light 主题切换，右上角 ThemeToggle

## Database Schema

5 张表：`users`, `xiaomi_accounts`, `schedules`, `run_logs`, `invite_codes`

Schema 定义在 `lib/db/schema.ts`，使用 Drizzle ORM。修改后运行 `npm run db:push` 同步。

## Environment Variables

必需变量（参考 `.env.example`）：

- `DATABASE_URL` — SQLite 路径 (默认 `./data/mimotion.db`)
- `ENCRYPTION_KEY` — 64 字符 hex，用于加密 Xiaomi token
- `JWT_SECRET` — 64 字符 hex，用于 JWT 签名
- `BARK_URL` — Bark 推送地址
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — 初始管理员

## Key Conventions

- 所有 API 路由使用 `getCurrentUser()` 验证登录状态
- Admin 专用路由额外检查 `isAdmin` 字段
- Xiaomi token 使用 AES-256-GCM 加密存储，密钥来自 `ENCRYPTION_KEY`
- 调度器使用 `Asia/Shanghai` 时区，分钟级匹配 cron 表达式
- 前端页面为 React Server Components，交互部分使用 `'use client'`
- 邀请码注册机制，管理员生成邀请码后用户才能注册
- 新增 shadcn 组件：`npx shadcn add <component>`
