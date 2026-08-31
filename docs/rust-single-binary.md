# Rust 单二进制运行架构

MiMotion 的 Rust 版本保留现有 React 视觉和交互，生产运行时由一个 Rust 进程同时提供 Web、API 和调度器。

    浏览器
      │
      ▼
    Axum
      ├── /api/auth、/api/xiaomi、/api/schedules
      ├── /api/invite、/api/admin、/api/user
      ├── 内嵌 Vite React 静态资源
      └── Tokio Scheduler
              ├── SQLite
              ├── Xiaomi/Zepp
              └── Bark / Telegram

## 本地构建

    npm install
    npm run build:frontend
    cargo build --manifest-path backend/Cargo.toml --release

构建完成后只需要运行：

    ./backend/target/release/mimotion

运行时仍然需要外部数据库和密钥。数据库默认位于 ./data/mimotion.db，不会写入二进制本身。

## 迁移策略

- Rust 迁移器复用 drizzle/migrations，兼容现有 _mimotion_migrations 记录。
- 认证 Cookie、AES-256-GCM 数据格式和主要 API 字段保持兼容。
- backend/src/xiaomi/data_template.txt 保留旧 Xiaomi/Zepp 请求模板，协议迁移必须通过固定请求样本验证。
- 当前 Next.js 版本暂时保留作为行为和视觉对照；Rust 版本完成验证后再切换默认构建入口。

## 运行配置

必须设置：

    DATABASE_URL=./data/mimotion.db
    ENCRYPTION_KEY=64位十六进制密钥
    JWT_SECRET=至少32字节的密钥
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=请设置强密码

AUTH_COOKIE_SECURE=false 仅适用于可信局域网的 HTTP 调试；生产环境应使用 HTTPS。
