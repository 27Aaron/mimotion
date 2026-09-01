# AGENTS.md — MiMotion

## Project Overview

Xiaomi/Zepp 自动刷步服务。用户绑定小米账号后，通过 cron 定时随机写入步数，支持推送通知（Bark、Telegram）。

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript
- **Backend**: Rust + Axum + Tokio
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-ui) + next-themes (dark/light)
- **Icons**: lucide-react（个别组件使用 @tabler/icons-react）
- **Database**: SQLite via SQLx
- **Auth**: JWT + bcrypt + HttpOnly cookies
- **Encryption**: AES-256-GCM (Xiaomi 凭据与推送配置存储)
- **Scheduler**: Tokio + custom five-field cron (Asia/Shanghai timezone)
- **Notifications**: Bark push service + Telegram Bot (可扩展)

## Commands

```bash
npm install           # 安装 frontend workspace 依赖
npm run dev:frontend  # Vite 前端开发服务器
npm run check         # 前端检查 + Rust 格式、测试和 Clippy
npm run build:single  # 构建前端并生成单一 Rust 二进制
npm run start:single  # 启动单一二进制
```

## Project Structure

```
frontend/
  src/app/                 # SPA 入口和应用级状态
  src/components/          # 共享 UI、布局和 Provider
  src/features/             # 业务页面和浏览器端 API
  src/i18n/messages/        # zh/en 语言包
  src/platform/             # 浏览器导航和平台适配
  src/lib/                  # 纯前端工具
  src/styles/               # 全局样式
backend/
  migrations/              # 版本化 SQLite 迁移
  src/auth/                # JWT、密码和会话
  src/security/            # 加密和限流
  src/storage/             # SQLite、迁移和模型
  src/scheduling/          # Cron 和持久化调度器
  src/notifications/       # Bark、Telegram
  src/xiaomi/              # Xiaomi/Zepp 协议
  src/web/                 # Axum API Handler
```

详细依赖规则见 `docs/architecture.md`。

## UI Architecture

- **字体**: LXGW WenKai Screen（霞鹜文楷屏幕阅读版），CDN 加载；等宽字体用 JetBrains Mono
- **shadcn/ui** 组件库，基于 `@base-ui/react`（非 Radix）
- Tailwind CSS v4，主题色通过 oklch CSS 变量定义（亮/暗两套）
- 主色调：翡翠绿 `oklch(0.596 0.145 163.2)`
- **绿色氛围系统**：全站统一的主色调环境光效，贯穿登录页和 Dashboard
  - 背景光晕：3 个 `fixed` 定位模糊圆形（`bg-primary/[0.03~0.07]` + `blur-[80~120px]`），分布在右上/左下/中央
  - 页面底色渐变：`bg-gradient-to-br from-background via-background to-primary/5`
  - 侧边栏渐变：`bg-gradient-to-b from-primary/10 via-primary/[0.06] to-sidebar`
  - 顶栏绿色高光条：`bg-gradient-to-r from-transparent via-primary/40 to-transparent`
  - 顶栏毛玻璃：`bg-background/80 backdrop-blur-sm`
  - Logo 阴影：`shadow-lg shadow-primary/25`
  - 卡片毛玻璃：`bg-card/80 backdrop-blur-md`（半透明 + 模糊，全局 Card 基础组件）
  - 卡片 hover 绿色边框光：CSS `.card-glow` 类（渐变 border + mask，hover 时 30% primary 渐变）
  - 导航项 hover：`hover:bg-primary/8 hover:text-primary`，active 左侧绿色指示条
  - 侧边栏 admin 分隔：邀请码/用户管理前插入 `fade-divider`，视觉分隔管理项
- 统一页面结构：页头（标题+描述）→ 统计概览卡片 → 内容卡片列表
- **页面布局**：所有 Dashboard 页面使用 `flex flex-col` + 手动 `mb-6` 精确控制间距（不使用 `space-y-*`），避免 CSS 选择器优先级导致的间距不对称问题
- 设置页：行对齐 2×2 grid（Row1: 用户名↔Bark，Row2: 密码↔Telegram），section header 带图标框+延伸线
- 空态引导：编号圆圈步骤指示（`bg-primary/10` + 数字），统一风格贯穿小米账号/控制台/定时任务页
- 侧边栏：Footprints 图标 logo（居中）+ 导航 + 用户信息区（含退出按钮），与右侧顶栏 `h-12` 像素对齐
- 用户系统使用 **用户名**（非邮箱）注册和登录，邮箱/手机号仅用于绑定小米账号
- 登录页：左右分栏（品牌介绍 Footprints logo + 切换式登录/注册表单），支持 URL `?code=XXX` 自动填入邀请码
- 邀请码：8 位十六进制短码（`crypto.randomBytes`），复制时生成完整注册 URL
- 所有内页（小米账号/定时任务/邀请码）使用卡片网格布局替代纯表格
- 所有页面支持 dark/light 主题切换，顶栏右侧 ThemeToggle
- CSS 自定义效果类（定义在 `globals.css`）：
  - `.fade-divider` / `.fade-border-*` — 主色调渐隐分割线
  - `.card-glow` — hover 时绿色渐变边框（30% primary）
  - `.glass` — 毛玻璃容器（`bg-card/70 backdrop-blur-12px`）
  - `.glass-subtle` — 轻量毛玻璃（`bg-card/50 backdrop-blur-8px`，用于 hover 覆层）
  - `.nav-item` — 导航项基础样式 + active 指示条
  - `.stats-grid` — 三列统计卡片网格（`mb-6 grid gap-4 sm:grid-cols-3`）
  - `.stat-card` — 紧凑统计卡片（`py-0.5 gap-1`，配合 stats-grid 使用）
  - `.stat-icon-box` — 统计卡片图标容器（`2.667rem` 方形圆角容器，SVG 子元素自动 `1.333rem`，需搭配 bg 色类）
  - `.stat-value` — 统计数值（`1.5rem mono bold`）
  - `.stat-label` — 统计标签（`0.75rem uppercase muted`）
  - `.section-icon` — 章节标题图标框（`flex h-5 w-5 rounded bg-primary/10`）
  - `.empty-icon` — 空态圆形图标（`flex h-12 w-12 rounded-full bg-primary/10`）
  - `.step-circle` — 步骤编号圆圈（`flex h-5 w-5 rounded-full bg-primary/10` + 字号色）

## Database Schema

Schema 由 `backend/migrations/` 和 Rust `storage` 模块维护。新增数据库变更时，新增版本化 SQL 迁移，并补充 Rust 测试。

### 关系图

```
users 1──N xiaomi_accounts   一个用户可绑定多个小米账号
users 1──N schedules         一个用户可创建多个定时任务
users 1──N invite_codes      管理员创建 / 用户使用
xiaomi_accounts 1──N schedules  一个小米账号可配多个任务（不同 cron）
schedules 1──N run_executions  一个任务每次计划执行占一个槽位
schedules 1──N run_logs      一个任务每次执行产生一条日志
rate_limits                  独立表，持久化限流计数（无外键）
```

### `users` — 用户表

| 字段                                      | 类型        | 说明                                  |
| ----------------------------------------- | ----------- | ------------------------------------- |
| id                                        | text PK     | UUID                                  |
| username                                  | text unique | 用户名（登录凭证）                    |
| passwordHash                              | text        | bcrypt 哈希                           |
| isAdmin                                   | boolean     | 管理员标记                            |
| locale                                    | text        | 语言偏好，默认 `zh`                   |
| barkUrlData + barkUrlIv                   | text?       | AES-256-GCM 加密的 Bark 推送地址      |
| telegramBotTokenData + telegramBotTokenIv | text?       | AES-256-GCM 加密的 Telegram Bot Token |
| telegramChatId                            | text?       | Telegram Chat ID（明文）              |
| createdAt / updatedAt                     | timestamp   | 时间戳                                |

业务逻辑：系统核心实体。推送配置（Bark/Telegram）存储在用户级别，该用户所有任务共享同一推送通道。Bark URL 和 Telegram Bot Token 以 AES-256-GCM + 独立 IV 加密存储（密钥来自 `ENCRYPTION_KEY`）；读取时优先解密加密列，旧明文列（`barkUrl` / `telegramBotToken`）仅作历史数据回退，新写入会清空。

### `invite_codes` — 邀请码表

| 字段      | 类型              | 说明                  |
| --------- | ----------------- | --------------------- |
| code      | text PK           | 8 位十六进制短码      |
| createdBy | text FK→users.id  | 创建者（管理员）      |
| usedBy    | text FK→users.id? | 使用者，null = 未使用 |
| createdAt | timestamp         | 创建时间              |

业务逻辑：注册准入控制。管理员生成 → 用户注册时填入 → `usedBy` 被标记后不可重复使用。索引 `usedBy` 用于快速查询某个用户的邀请来源。

### `xiaomi_accounts` — 小米账号表

| 字段                          | 类型             | 说明                                             |
| ----------------------------- | ---------------- | ------------------------------------------------ |
| id                            | text PK          | UUID                                             |
| userId                        | text FK→users.id | 所属用户                                         |
| xiaomiUserId                  | text?            | 小米用户 ID                                      |
| account                       | text?            | 账号标识（手机/邮箱）                            |
| tokenData + tokenIv           | text             | AES-256-GCM 加密的 Xiaomi token                  |
| loginTokenData + loginTokenIv | text?            | AES-256-GCM 加密的 login token（用于自动重登录） |
| passwordData + passwordIv     | text?            | AES-256-GCM 加密的密码（用于自动重登录）         |
| deviceId                      | text?            | 设备标识                                         |
| nickname                      | text?            | 昵称                                             |
| status                        | text             | 状态，默认 `active`                              |
| lastSyncAt                    | timestamp?       | 最后同步时间                                     |
| lastError                     | text?            | 最后错误信息                                     |

业务逻辑：一个用户可绑定多个小米账号。三组加密字段（token/loginToken/password）均使用 AES-256-GCM + 独立 IV，密钥来自 `ENCRYPTION_KEY`。存储 loginToken 和加密密码是为了 token 过期时自动重登录。`status` 控制账号可用性（active/error），`lastError` 记录最近失败原因。索引 `userId` 用于按用户查询账号列表。

### `schedules` — 定时任务表

| 字段                  | 类型                       | 说明                              |
| --------------------- | -------------------------- | --------------------------------- |
| id                    | text PK                    | UUID                              |
| userId                | text FK→users.id           | 所属用户                          |
| xiaomiAccountId       | text FK→xiaomi_accounts.id | 关联的小米账号                    |
| cronExpression        | text                       | cron 表达式（Asia/Shanghai 时区） |
| minStep / maxStep     | integer                    | 步数范围                          |
| isActive              | boolean                    | 是否启用，默认 true               |
| lastRunAt / nextRunAt | timestamp?                 | 执行时间跟踪                      |
| createdAt / updatedAt | timestamp                  | 时间戳                            |

业务逻辑：每个任务绑定一个小米账号 + cron 时间 + 步数范围。调度器按 cron 表达式触发，在 [minStep, maxStep] 区间内随机生成步数写入小米。双重外键（userId + xiaomiAccountId）保证数据隔离。索引 `isActive` 用于调度器快速获取所有活跃任务。`nextRunAt` 用于前端展示下次执行时间。

### `run_logs` — 执行日志表

| 字段         | 类型                 | 说明                      |
| ------------ | -------------------- | ------------------------- |
| id           | text PK              | UUID                      |
| scheduleId   | text FK→schedules.id | 关联定时任务              |
| executedAt   | timestamp            | 执行时间                  |
| stepWritten  | integer?             | 实际写入的步数            |
| status       | text?                | 执行状态（success/error） |
| errorMessage | text?                | 错误信息                  |

业务逻辑：每次调度执行产生一条记录。成功记录 `stepWritten`，失败记录 `errorMessage`。通过 `scheduleId` 可追溯某个任务的完整执行历史，用于 Dashboard 展示和控制台统计。索引 `scheduleId` 用于按任务查询日志。

### `run_executions` — 调度执行槽位表

| 字段                     | 类型                       | 说明                                                               |
| ------------------------ | -------------------------- | ------------------------------------------------------------------ |
| id                       | text PK                    | UUID                                                               |
| scheduleId               | text FK→schedules.id       | 关联定时任务                                                       |
| xiaomiAccountId          | text FK→xiaomi_accounts.id | 关联的小米账号                                                     |
| scheduledFor             | timestamp                  | 计划执行时间（槽位）                                               |
| status                   | text                       | 状态，默认 `pending`（pending/running/succeeded/failed/discarded） |
| attempt                  | integer                    | 已尝试次数，默认 0                                                 |
| targetStep               | integer?                   | 目标步数                                                           |
| claimedAt                | timestamp                  | 被调度器认领的时间                                                 |
| startedAt / finishedAt   | timestamp?                 | 开始 / 结束时间                                                    |
| errorCode / errorMessage | text?                      | 失败原因                                                           |
| createdAt / updatedAt    | timestamp                  | 时间戳                                                             |

业务逻辑：持久化调度器的执行槽位，调度器为每个任务的每个计划时间点预先插入一行 `pending` 记录。唯一索引 `(scheduleId, scheduledFor)` 和 `(xiaomiAccountId, scheduledFor)` 防止同一槽位重复调度、同一账号并发执行。worker 按 `scheduledFor` 顺序认领 `pending` 槽位（`attempt` 超过上限不再重试），完成后写 `run_logs`。

### `rate_limits` — 限流表

| 字段    | 类型      | 说明                             |
| ------- | --------- | -------------------------------- |
| key     | text PK   | 限流键（如认证接口 + 客户端 IP） |
| count   | integer   | 当前窗口计数                     |
| resetAt | timestamp | 窗口重置时间                     |

业务逻辑：`security` 模块的持久化限流存储（登录、注册等认证接口的固定窗口限流），进程重启后计数不丢失。过期窗口记录按 `resetAt` 索引清理。

## Environment Variables

必需变量（参考 `.env.example`）：

- `DATABASE_URL` — SQLite 路径 (默认 `./data/mimotion.db`)
- `ENCRYPTION_KEY` — 64 字符 hex，用于加密 Xiaomi 凭据和推送配置
- `JWT_SECRET` — 64 字符 hex，用于 JWT 签名
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — 初始管理员（默认 `admin` / `password`）
- Bark 和 Telegram 推送均由用户在设置页自行配置，无需全局环境变量

可选变量：

- `MIMOTION_HOST` — Web 监听地址（默认 `127.0.0.1`，容器部署设 `0.0.0.0`）
- `PORT` — Web 监听端口（默认 `3000`）
- `AUTH_COOKIE_SECURE` — 登录 Cookie Secure 标记；HTTPS 部署设 `true`，仅可信局域网 HTTP 调试设 `false`（未设置时跟随 `NODE_ENV=production`）
- `WORKER_CONCURRENCY` — 调度器并发数（默认 `3`）
- `WORKER_POLL_INTERVAL_MS` — 调度器轮询间隔（默认 `10000`）

## Key Conventions

- 所有 API 路由在 `backend/src/web` 验证会话和所有权
- Admin 专用路由额外检查 `is_admin` 字段
- Xiaomi 凭据和推送配置（Bark URL、Telegram Bot Token）使用 AES-256-GCM 加密存储，密钥来自 `ENCRYPTION_KEY`
- 调度器使用 `Asia/Shanghai` 时区，分钟级匹配五字段 cron 表达式
- 前端页面全部是 Vite/React 浏览器组件
- 邀请码注册机制，管理员生成邀请码后用户才能注册
- 邀请码为 8 位十六进制短码，复制时生成 `/login?code=XXX` 注册链接
- 用户管理页（admin）：表格居中对齐，按注册时间升序排列，支持重置密码、查看推送配置状态
- 新增 shadcn 组件：在 `frontend` workspace 中运行 `npx shadcn add <component>`
