# MiMotion 代码架构

项目采用“路由入口 + 业务领域 + 基础设施”三层结构：

```text
app / worker
      ↓
   features
      ↓
     lib
```

- `app/`：只描述 Next.js 路由、布局和全局样式。页面与 Route Handler 保持为薄入口。
- `features/`：按业务领域组织页面、浏览器客户端、请求契约和服务端处理器。
- `lib/`：与具体页面无关的基础能力，例如数据库、认证、加密、通知和 Xiaomi 协议。
- `components/`：跨业务复用的 UI；`components/ui` 保留 shadcn 原始组件。
- `worker/`：后台进程入口，实际调度逻辑位于 `lib/scheduling`。
- `tests/`：生产代码之外的自动化测试。

## 目录约定

```text
app/
  [locale]/.../page.tsx       # 页面路由适配器
  api/.../route.ts            # HTTP 路由适配器
components/
  dashboard/                  # Dashboard 跨页面组件
  layout/                     # 导航、主题切换、语言切换
  providers/                  # React Context / 全局 Provider
  ui/                         # shadcn/ui 基础组件
features/
  <domain>/
    client.ts                 # 浏览器端 API 客户端（可选）
    components/               # 领域私有组件（可选）
    contracts.ts              # 领域请求校验（可选）
    model.ts                  # 领域类型与纯函数（可选）
    screens/                  # 页面级组件
    server/                   # Route Handler / 服务端用例
lib/
  api/                        # 通用 API 校验辅助
  auth/                       # JWT、密码、注册和重定向
  db/                         # SQLite、Drizzle Schema、数据所有权操作
  http/                       # 通用 HTTP 客户端
  notifications/             # Bark、Telegram 与通知凭据
  scheduling/                # Cron、持久化执行队列和 Worker
  security/                  # 加密、限流和 URL 安全检查
  xiaomi/                     # Xiaomi/Zepp 协议实现
tests/unit/                   # 单元测试
```

## 依赖规则

1. `app` 可以引用 `features`、`components` 和 `lib`，但不放业务实现。
2. `features` 可以引用 `components` 和 `lib`；不同 feature 之间不直接依赖内部文件。
3. `lib` 不引用 `features` 或 `app`。
4. 浏览器代码放在 `client.ts` 或带 `"use client"` 的 screen/component 中；数据库和密钥逻辑只能位于服务端文件。
5. 通用组件只有在至少两个领域复用时才放入 `components`，否则保留在所属 feature。
6. Schema 变更通过 `npm run db:generate` 生成迁移，不直接修改已经应用的迁移文件。

## 新增功能示例

新增一个 `reports` 领域时，优先创建：

```text
features/reports/
  client.ts
  components/report-filter.tsx
  contracts.ts
  screens/reports-screen.tsx
  server/handlers.ts
```

对应的 `app/[locale]/.../reports/page.tsx` 和 `app/api/reports/route.ts` 只导入或重新导出这些实现。
