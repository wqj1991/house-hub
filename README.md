# house-hub

三端一后端（Web / 桌面 / 移动 + VPS 同步中枢）。设计见 [`docs/`](docs/README.md)：

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — 目标架构、Repo 接口、同步协议、API 路由、迁移 P0–P5
- [TECH-STACK.md](docs/TECH-STACK.md) — 选型定稿与版本锚点
- [docs/adr/](docs/adr/README.md) — 决策记录 0001–0005（全部在本仓库）
- [CONTRIBUTING.md](CONTRIBUTING.md) — 工具链、日常命令、提交前检查
- [infra/README.md](infra/README.md) — 部署面：openresty / systemd / 备份 / 滚版

## 目录

```text
apps/web            Vite SPA，产物 = 静态 dist；桌面 4 个视图 + 移动 7 个屏 + 9 个壳组件
apps/shell          Tauri 2 壳（desktop + android），复用 apps/web/dist
packages/core       纯函数域内核（零 IO）：domain / scoring / content / schema
packages/protocol   路由常量、同步信封、错误码、字段所有权表（零依赖）
packages/data       HouseRepo 接口 + LocalRepo + RemoteRepo + outbox + SyncEngine
packages/ui         悬浮纸主题 tokens 与基础组件（Button / Sheet / tokens.css）
services/api        Node 24 + Hono + better-sqlite3，house.db 的唯一写者
services/worker     Python 3.6 兼容的抓数 / 重算 job 执行器（零三方依赖）
scripts             smoke.sh（API 冒烟）、version.mjs（版本号单一来源）
infra               openresty、systemd、备份与 1Panel 部署脚本
docs                架构 / 选型 / ADR / UI 设计稿（docs/ui 是 169KB 设计稿 + spec）
```

## 起步

```bash
pnpm install
pnpm dev            # http://localhost:1420 —— 浏览器里跑 Web 端（RemoteRepo，需要 API）
pnpm api:dev        # http://127.0.0.1:8787 —— 本地 API，首次启动自动建库
pnpm typecheck      # 全仓 tsc --noEmit
pnpm build          # apps/web → dist
pnpm version:check  # 校验 7 个包的版本没有漂移
pnpm check:schema   # 本地 schema 与服务器迁移的列对齐（缺表/缺列退出码 1）
pnpm deploy         # 构建 → 打包 → 服务器原子切换 → 自检 → 失败自动回滚（见 infra/README）
```

桌面壳：`pnpm app:dev`（需要 Rust 1.90+）。移动壳：`pnpm --filter @house/shell android:dev`。

## 当前进度（对齐 ARCHITECTURE §11）

| 阶段 | 状态 | 事实 |
|---|---|---|
| P0 抽 HouseRepo | 接口就位，壳接了一半 | `packages/data` 的 local / remote / outbox 已写；`apps/shell/src-tauri/src/lib.rs` 已搬 13 个命令（含 `apply_sync_page`、`list_rules`），剩 12 个在文件末尾 `TODO(P3)` |
| P1 只读 API + Web | 本地可用 | `/communities`、`/communities/:uid`、`/rules`、`/health` 已通；Web 端 11 个页面经 `getRepo()` 取数，库里没数据时回落 `apps/web/src/lib/demo.ts` 示例口径 |
| P2 同步 | 已通 | 落库链路打通：Rust `apply_sync_page` 单事务 upsert + 墓碑、本地 rev 存 `sync_meta`；Web 端 pull 的页落 IndexedDB 快照（`packages/data/src/snapshot.ts`）。见 ADR 0006 |
| P3 抓数上云 | 只有 stub | `services/worker/worker.py` 的 `community_fill` / `route_compute` 领活后只回写 note |
| P4 拆 workspace | 已完成 | `apps/*` + `packages/*` + `services/*` 三组；评分内核 `packages/core/src/scoring/*` 仍带 `TODO(P4)`，真实口径以 `D:\repos\house` 为准 |
| P5 收尾 | 部分 | 规则 hash 已走 `list_rules`（FNV-1a 64）；Web hash 路由已接（`apps/web/src/App.tsx`）；outbox「待同步 N 条」界面与 iOS 签名未做 |

> 领域内核与规则口径仍以 `D:\repos\house` 为准，迁移顺序见 ARCHITECTURE §11；本仓库只放「怎么长成三端」。
