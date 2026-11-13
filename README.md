# house-hub

三端一后端（Web / 桌面 / 移动 + VPS 同步中枢）。设计见 [`docs/`](docs/README.md)：

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — 目标架构、Repo 接口、同步协议、API 路由、迁移 P0–P5
- [TECH-STACK.md](docs/TECH-STACK.md) — 选型定稿与版本锚点
- [adr/0005-多端一后端.md](docs/adr/0005-多端一后端.md) — 为什么加一台服务器

## 目录（骨架已按 ARCHITECTURE §4 落地）

```text
apps/web          Vite SPA，产物 = 静态 dist
apps/shell        Tauri 2 壳（desktop + android），复用 apps/web/dist
packages/core     纯函数域内核（零 IO）：domain / scoring / content / schema
packages/protocol 路由常量、同步信封、错误码、字段所有权表（零依赖）
packages/data     HouseRepo 接口 + LocalRepo + RemoteRepo + outbox + SyncEngine
packages/ui       悬浮纸主题 tokens 与基础组件
services/api      Node 24 + Hono + better-sqlite3，house.db 的唯一写者
services/worker   Python 3.6 兼容的抓数 / 重算 job 执行器
infra             openresty、systemd、备份与 1Panel 部署脚本
```

## 起步

```bash
pnpm install
pnpm dev            # http://localhost:1420 —— 浏览器里跑 Web 端（RemoteRepo，需要 API）
pnpm api:dev        # http://127.0.0.1:8787 —— 本地 API，首次启动自动建库
pnpm typecheck      # 全仓 tsc --noEmit
pnpm build          # apps/web → dist
```

桌面壳：`pnpm app:dev`（需要 Rust 1.90+）。移动壳：`pnpm --filter @house/shell android:dev`。

## 迁移进度

骨架对应 ARCHITECTURE §11 的 **P0 之前**：目录与接口已就位，页面尚未搬迁。
下一步按 P0 把 `D:\repos\house\src\db.ts` 的 19 个命令搬进 `packages/data/local.ts`，
再把 `D:\repos\house\src\App.tsx` 与 pages/ 搬进 `apps/web/src`。
