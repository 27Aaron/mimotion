# MiMotion 代码架构

当前生产架构只有两个运行时：`frontend` 负责浏览器界面，`backend` 负责 Rust Web/API、数据库、调度和 Xiaomi 协议。

```text
浏览器
  │
  ▼
frontend/  Vite + React
  │ /api
  ▼
backend/   Axum + SQLx + Tokio Scheduler
  ├── SQLite
  ├── Xiaomi/Zepp
  └── Bark / Telegram
```

## 目录约定

```text
frontend/
  public/                    # 静态资源
  src/
    app/                     # SPA 入口和应用级状态
    components/
      dashboard/             # 跨页面 Dashboard 组件
      layout/                # 导航、主题、语言和布局
      providers/             # 全局 Provider
      ui/                    # shadcn/base-ui 基础组件
    features/                # 按业务领域组织页面和浏览器端 API
      <domain>/
        components/          # 领域私有组件
        screens/             # 页面级组件
        client.ts            # 浏览器端 API 客户端
        model.ts             # 前端类型与纯函数
    i18n/
      messages/              # zh/en 语言包
    platform/                # 浏览器导航、链接和国际化适配
    lib/                     # 纯前端工具（api.ts 统一 fetch 封装、时间格式化等）
    styles/                  # 全局样式
  index.html
  vite.config.ts
  package.json

backend/
  migrations/                # Rust 启动时执行的版本化 SQLite 迁移
  src/
    main.rs                  # 单进程入口
    lib.rs                   # 模块组装入口
    config.rs                # 环境变量和服务配置
    state.rs                 # 共享应用状态
    util.rs                  # 公共工具（now_ms 等）
    auth/                    # JWT、密码和会话
    security/                # 加密和限流
    storage/                 # SQLite 连接、迁移、数据模型和共享查询
    scheduling/              # Cron 和持久化调度器
    notifications/           # Bark、Telegram
    xiaomi/                  # Xiaomi/Zepp 协议
    web/                     # Axum 路由和 API Handler
  Cargo.toml

```

## 依赖规则

1. `frontend/src/app` 只负责应用入口、路由状态和页面组合。
2. `frontend/src/features` 可以使用共享组件、前端工具和其他公开契约，但不依赖服务端实现。
3. `frontend/src/components` 只放跨领域复用组件；领域专用组件留在对应 feature。
4. `frontend/src/i18n/messages` 是唯一的前端语言包位置。
5. `backend/src/web` 只负责 HTTP 输入输出和权限边界；数据库、调度和协议实现放在对应模块。
6. `backend/src/storage` 是数据库访问边界，敏感凭据必须经过 `security` 加密后存储。
7. `backend/migrations` 是唯一的生产迁移来源，Rust 启动时按版本执行 SQL。
8. 根目录不放业务源代码；前端和后端实现分别归属于 `frontend/` 与 `backend/`。

## 构建约定

```bash
npm install
npm run check
npm run build:single
npm run start:single
```

`build:single` 先构建 `frontend/dist`，再由 Rust 编译器通过 `rust-embed` 将静态资源嵌入 `backend` 二进制。
