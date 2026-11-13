# house-hub · docs 索引

这里是「三端一后端」架构的落点仓库。骨架已按 `ARCHITECTURE.md` §4 落地（代码目录、包边界、API 路由都在）。**进度以根 [README.md](../README.md) 的「当前进度」为准**，本文只说文档本身。

| 文件 | 是什么 | 状态 |
|---|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 三端一后端的目标架构：现状盘点、Repo 接口、同步协议（uid+rev+字段所有权）、API 路由表、数据模型增量、抓数流水线、部署拓扑、迁移 P0–P5 | 提案；§4 目录与 §7 路由已落地，§8 数据模型仍在增量 |
| [`TECH-STACK.md`](TECH-STACK.md) | 选型定稿：运行时基线、前端/共享包/壳/后端/抓数的依赖清单与版本锚点、数据层约定、构建与测试、版本策略、明确不用的东西 | 定稿 |
| [`adr/`](adr/README.md) | 决策记录 0001–0005，一篇一个决定；索引与取代关系在 `adr/README.md` | 全部在本仓库，正文有效 |
| [`ui/spec.md`](ui/spec.md) | UI 设计输入：产品口径、使用者场景、核心信息点（只说「要说什么」，不说「长什么样」） | 有效 |
| [`ui/index.html`](ui/index.html) | 悬浮纸主题包的三方向设计稿（169 KB，单文件可视） | 参考件：样式真值以 `apps/web/src/styles/glass.css` 为准 |

## 文档从哪里来

架构是在现役项目 `D:\repos\house`（Tauri 单进程、本地优先，v0.1 已跑起来）上做的演进设计。`ARCHITECTURE.md` 与 `TECH-STACK.md` 最初写在 `house/docs/` 下，现迁到本仓库作为新工程的主设计；house 那边保留同名副本，等本仓库 P4 完成后删除。

ADR 0001–0004 同样在 2026-11-13 迁入 `adr/`（正文逐字保留，标题下加了一行来源说明），0005 本就写在这里。**从现在起 ADR 只在本仓库写**，house 的副本冻结。

## 仍未迁入（仍以 house 为准）

以下属于内容资产而非架构决策，等 P4 迁领域内核时一起搬：

- `DESIGN.md` —— 领域决策 D1–D17（单家庭不做账号体系、一切皆配置、班车数据离线抓包）
- `GLOSSARY.md` —— 领域术语边界（单价/总价、两级口径、品质、市场代理）
- `买房攻略.md`、`小区品质分项.md`、`房屋打分项.md`、`打分卡/*.xlsx`

`ARCHITECTURE.md` §14 说明了它与既有 ADR 的关系：只部分取代 ADR-0002 中「没有服务端」那半句，其余全部继续有效。

## 下一步

产品侧按 `ARCHITECTURE.md` §11：**P2 同步闭环**（`packages/data/src/sync.ts` 的 `applyPage`）→ **P3 抓数上云**（`services/worker` 的真实 handler）→ 其余 P0/P4/P5 收尾。

工程侧三件先行事项（细节见 [`CONTRIBUTING.md`](../CONTRIBUTING.md)）：

1. `pnpm test` 现在没有用例 —— `packages/core` 有 vitest 配置但全仓 0 个测试文件，先补评分与协议的最小用例。
2. 没有 lint 和 CI —— 先在 CI 里跑 `typecheck + test + build`，再谈风格统一。
3. `infra/deploy.sh` 有几处会让生产起不来的问题（前端 `dist` 被 rsync 排除、`--prod` 装不上 `tsx`、没有自动回滚），部署前先修。
