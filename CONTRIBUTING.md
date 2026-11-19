# 贡献指南 · house-hub

单人项目的协作规则，写下来是为了半年后自己不忘。**工具链版本即约束**，不是建议。

## 工具链

| 工具 | 版本 | 为什么是这个 |
|---|---|---|
| Node | 24.x（`engines: >=24`） | `services/api` 用 `node:sqlite` 之外的稳定面；Vite 7 要求 ≥20 |
| pnpm | 11.25.0（`packageManager`） | 锁文件格式与 `onlyBuiltDependencies` 行为都绑在这个大版本上 |
| Rust | 1.99（`rustc`/`cargo`），最低 1.90 | Tauri 2 的下限；`apps/shell/Cargo.lock` 已入库 |
| Python | 3.6 语法兼容 | 线上机器只有发行版自带的 python3，`services/worker` 只用标准库 |

工程可能在 exFAT 盘上，`pnpm-workspace.yaml` 因此设了 `nodeLinker: hoisted` —— 别改成默认的 symlink 模式，会 `ERR_PNPM_EISDIR`。

## 第一次跑起来

    pnpm install
    pnpm api:dev      # http://127.0.0.1:8787，首次启动自动建库并跑迁移
    pnpm dev          # http://localhost:1420，Web 端（走 /house-api 代理到上面的 API）
    pnpm web:dev      # 上面两条合成一条：API 18878 + Vite 1420，自动开浏览器（scripts/web-dev.sh）
    pnpm typecheck    # 全仓 tsc --noEmit

桌面壳要 Rust：`pnpm app:dev`。安卓壳先 `pnpm --filter @house/shell android:init`。

## 提交前必跑

    pnpm typecheck && pnpm version:check && pnpm test

`pnpm test` 目前只有 `packages/core` 有 vitest 配置（还没有用例），见 docs/README.md 的待办。

## 约定

1. **换行符**：仓库里一律 LF，`.gitattributes` 强制。`.sh` / `.service` / `.conf` 带 CRLF 会在 Linux 上直接崩（`bash: \r: command not found`）。
2. **版本号**：只改根 `package.json` 的 version，然后 `pnpm version:sync`。`apps/shell/src-tauri/tauri.conf.json` 的 `version` 是路径 `../package.json`，不要手写。
3. **Schema 双写**：改表结构必须同时改 `apps/shell/src-tauri/src/schema.sql`（或加迁移）与 `services/api/src/migrations/000X_*.sql`，两边字段集合要一致；提交说明里贴两份 diff 的结论。
4. **密钥**：只走环境变量。服务器上是 `/opt/house/api.env`、`worker.env`（chmod 600），仓库只放 `*.example`。不要把 token 写进任何 `.ts` / `.sh` / 文档。
5. **依赖归属**：只往对应的子包加依赖，根 `package.json` 不放 runtime 依赖。workspace 内部引用一律 `workspace:*`。
6. **包导出**：`packages/*` 的 `exports` 指向 `src/index.ts`（源码直出，由 vite/tsx 现场编译）。要改成 `dist` 就必须同时改三端构建，别只改一个包。
7. **TODO 带阶段**：写成 `// TODO(P2): 做什么`，阶段号对齐 ARCHITECTURE §11，这样 `grep TODO(P2)` 就是待办清单。
8. **文档同改**：改了目录、路由、协议或进度，同时改 `README.md`、`docs/README.md`；改了决定就加新 ADR，不改旧 ADR 的结论。

## 提交信息

`<type>: <一句话>`，type 取 `feat` / `fix` / `chore` / `docs` / `refactor` / `test` / `perf` / `infra`。
正文解释**为什么**，不复述 diff。一个提交只做一件事；格式化与逻辑改动分开。

## 分支与发布

- `main` 常驻可部署，不直接在 `main` 上做实验。
- 功能分支 `feat/<topic>`，合并前跑一遍「提交前必跑」。
- 发布 = 改根版本 → `pnpm version:sync` → `git tag -a vX.Y.Z`。基线已是 `v0.2.0`。
- 部署见 [`infra/README.md`](infra/README.md)。`infra/deploy.sh` 目前没有自动回滚，且有几处已知问题（前端 dist 被 rsync 排除、`--prod` 装不上 `tsx`），动它之前先读一遍。

## ADR

新决策写到 `docs/adr/000N-短标题.md`，在 [`docs/adr/README.md`](docs/adr/README.md) 索引里加一行，并同步 `docs/ARCHITECTURE.md` §14 的关系表。
