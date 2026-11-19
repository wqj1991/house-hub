# TECH-STACK — 选型定稿

> 状态：定稿（2026-11-13）。配套 ARCHITECTURE.md。凡是「版本」都以锁文件为准，本文写的是**大版本锚点与不可越过的边界**。
> 原则：能不引就不引。每加一个依赖，都要多付一份升级、审计、打包体积的代价；本项目是一个人维护的私人工具。

## 0. 一页速查

| 层 | 选型 | 锚点版本 | 一句话理由 |
|---|---|---|---|
| 语言 | TypeScript | 5.9.x，strict | 三端一服务同一份类型 |
| 前端框架 | React | 19.2 | 现状，Server Components 不用 |
| 构建 | Vite | 7.1 | Tauri 官方路径，产物就是静态 dist |
| 样式 | Tailwind CSS + @tailwindcss/vite | 4.1 | CSS-first，无 tailwind.config.js |
| 组件基元 | Radix 原语（仅 slot / tabs）+ 自研 | 1.2 / 1.1 | 主题是自制的，不引整套 UI 库 |
| 图标 | lucide-react | 0.545 | 树摇干净，与 radix 同审美 |
| 桌面/移动壳 | Tauri | 2.9（crate 2.x，CLI 2.9） | 桌面 6 MB、Android 6.7 MB，复用同一 dist |
| 本地库 | rusqlite（bundled）+ SQLite | 0.37 / 3.45 | bundled 不赌系统库，Android 必须有 |
| 服务器运行时 | Node | 24 LTS | 与前端同语言，可直用 packages/core |
| Web 框架 | Hono | 4.x | 10 KB 级、无依赖、跑在 node:http 上 |
| 服务端库 | better-sqlite3 | 12.x | 同步 API，单写者模型天然契合 |
| 校验 | Zod | 4.x | 前后端共用同一份 DTO schema |
| 日志 | pino | 9.x | JSON 进 journald，字段可 grep |
| 抓数 | Python | 3.6 兼容语法 | 服务器自带 3.6，零第三方依赖是硬约束 |
| 测试 | Vitest | 3.x | 前后端一套配置，无 jest 的 ESM 折磨 |
| 包管理 | pnpm | 11.x workspace | 现状；hoisted 保留（见 §8） |
| 反代 | openresty | 机器现有 | 不新增组件 |
| 进程管理 | systemd | 机器现有 | 不装 Docker |
| 备份 | sqlite3 .backup + rclone | — | 单文件库，复制即可 |

## 1. 运行时基线

~~~text
本地开发    Node 24.18.0 · pnpm 11.25.0 · Python 3.13.0 · Rust 1.99.1 · git 2.56
服务器      同 Node 24（用 nodesource 或 nvm 装，不用发行版自带）
             Python 3.6.9（Ubuntu 自带，worker 必须兼容此版本语法）
             SQLite 3.45（系统 libsqlite3，服务端 better-sqlite3 内置同一大版本）
目标平台    Windows 10+ / macOS 12+ / Linux glibc 2.31+
            Android minSdk 24 · targetSdk 37 · arm64-v8a（现状）
            iOS 16+（未签名，待 Apple 账号）
~~~

硬边界：

- **客户端代码不得使用 Node API**。packages/core 与 apps/web 里不出现 fs / path / process。例外：构建脚本（vite.config.ts、scripts/*.mjs）可以用，它们不打包进产物。
- **服务端代码不得假设 Linux 之外的路径**。/var/lib/house/house.db 写进配置，不写死进代码。
- **Python 侧锁 3.6 语法**：不用海象运算符（3.8）、不用 dataclass（3.7）、不用 f-string 的 = 调试语法（3.8）。原因：47.95.238.28 上是 3.6，升级 Python 要动 1Panel 的运行时，风险大于收益。
- **Rust 用 1.90 作为 rust-version 下限**（Cargo.toml 已声明），本机 1.99.1 可编。不追 nightly。

## 2. 前端

| 依赖 | 版本 | 用途 | 不引什么 / 为什么 |
|---|---|---|---|
| react / react-dom | 19.2 | UI | 不用 Next.js：无 SEO、Tauri 里跑不了、多一层构建 |
| typescript | 5.9 | 类型 | 不引 babel/ts-node，Vite 负责转译，tsc 只做 --noEmit 检查 |
| vite | 7.1 | 构建 + dev server | 不用 webpack/rspack，Tauri 官方模板就是 Vite |
| @vitejs/plugin-react | 5.0 | JSX + Fast Refresh | — |
| tailwindcss + @tailwindcss/vite | 4.1 | 样式 | 不引 CSS-in-JS；v4 无配置文件，主题写在 CSS 的 @theme 里 |
| @radix-ui/react-slot | 1.2 | asChild 组合 | 只装这一个原语，剩下的 UI 自研（悬浮纸主题是自己写的） |
| @radix-ui/react-tabs | 1.1 | 无障碍标签页 | 同上，够用即止 |
| lucide-react | 0.545 | 图标 | 不引 iconfont、不内联 SVG 雪碧图（Sprite.tsx 是自有图形，不在此列） |
| clsx | 2.1 | 类名拼接 | — |
| tailwind-merge | 3.3 | 冲突类合并 | 与 clsx 组合成 cn() |
| class-variance-authority | 0.7 | 变体声明 | shadcn 风格，保留 |

明确不引：

| 不引 | 替代 | 理由 |
|---|---|---|
| react-router | 自研 Page[] 栈（App 内 + Web 端 hash 路由约 80 行） | 页面只有 10 个、导航是「标签 + 压栈」，router 的嵌套/loader/守卫全用不上 |
| 状态库（zustand/redux/jotai） | useStore()（Context + useReducer） | 全局状态就一个 store.tsx；数据缓存交给 Repo 层 |
| TanStack Query / SWR | packages/data 的 Repo + SyncEngine | Repo 已经是唯一数据入口，再叠一层请求缓存会变成两套失效策略 |
| UI 组件库（antd/mui/shadcn 全量） | 自研 + radix 原语 | 主题是「悬浮纸」，套库等于跟库的审美打架 |
| 动画库（framer-motion） | CSS transition/keyframes | 现有动效都是 CSS 能做的那类 |
| 表单库（react-hook-form） | 受控组件 | 表单都是 5 个字段以内 |
| i18n 框架 | 中文写死 | 单语言（D13 一切皆配置，但语言不是配置项） |
| 日期库（dayjs/luxon） | Intl.DateTimeFormat | 只需要「今天/本周」，浏览器自带 |

## 3. 共享包（packages/*）

| 包 | 内容 | 依赖约束 |
|---|---|---|
| core | domain 类型、scoring 纯函数、content 文案、schema(zod) | 只依赖 zod。**零 IO、零 DOM、零 Tauri** |
| protocol | SyncEnvelope、ApiRoutes 常量、错误码枚举 | 零依赖 |
| data | HouseRepo 接口 + local/remote/outbox/sync | 可依赖 core/protocol；Tauri API 只能动态 import |
| ui | 主题 tokens、基础组件、shadcn 原语包装 | 只依赖 react/radix/cva/clsx/tailwind-merge |

三条纪律：

1. packages/core 里出现 import 任何带副作用的东西（fetch、window、invoke、node:fs）＝ code review 直接打回。它是三端与服务器的唯一共同真相。
2. packages/protocol 只放常量与类型，不放逻辑。前端与服务端都 import 它，路径字符串不允许手写第二遍。
3. packages/ui 不做数据访问。组件收 props，回调往上抛。

## 4. 壳：Tauri 2

| 项 | 值 | 说明 |
|---|---|---|
| tauri / tauri-build (crate) | 2.x | 与 CLI 2.9 对齐，不跨大版本混用 |
| @tauri-apps/api / cli | 2.9.0 | 前后端 IPC 与构建 |
| rusqlite | 0.37，features = bundled | 自带 SQLite 源码；Android/iOS 不赌系统 libsqlite3 |
| serde / serde_json | 1.x | 命令入参出参 |
| Rust edition | 2021，rust-version 1.90 | 与 Cargo.toml 现状一致 |
| release profile | panic=abort, lto=true, codegen-units=1, opt-level=s, strip=true | 体积优先（现状已验证） |
| 窗口 | 单窗口，装饰由前端画 | 与「悬浮纸」主题一致 |
| dev server | 1420 strictPort，Android 真机 HMR 走 1421 + TAURI_DEV_HOST | 现状，别改 |

插件选型（按需加载，不预装）：

| 需求 | 插件 | 备注 |
|---|---|---|
| 设置与本地偏好 | @tauri-apps/plugin-store | 轻，键值即可；不引 stronghold 除非存密码 |
| 设备令牌 | plugin-store（加密字段由系统钥匙串保护）或 plugin-stronghold | 先 store，要更强再换 |
| 导入导出文件 | @tauri-apps/plugin-dialog + plugin-fs | 导出 CSV/JSON 用 |
| 打开外部链接 | @tauri-apps/plugin-opener | 高德/链家跳转 |
| 网络请求 | 不引 plugin-http | 桌面/移动用原生 fetch（Tauri 2 支持），CORS 由服务端配 |
| 通知/后台同步 | 暂不引 | v2 再说，先靠「切回前台时 sync」 |

移动端：

- Android：minSdk 24、targetSdk 37、arm64-v8a（现状）。构建脚本 scripts/android-apk.mjs 继续用，不引 Capacitor/Cordova。
- iOS：Tauri 2 支持，但需要 Apple 开发者账号 + macOS 构建机。**当前不排期**，代码层面不写 iOS 专属分支。
- 明确不用 React Native / Flutter：UI 已经是 Web，复用率 100%，RN 等于把 UI 重写一遍。

## 5. 后端 API（services/api）

| 依赖 | 版本 | 用途 |
|---|---|---|
| hono | 4.x | 路由、中间件、SSE 备用 |
| @hono/node-server | 1.x | 把 Hono 挂到 node:http |
| better-sqlite3 | 12.x | 同步 API、事务、WAL |
| zod | 4.x | 请求/响应校验，与 packages/core 共用 |
| pino | 9.x | 结构化日志 |
| pino-pretty | 9.x | 仅 devDependency，本地可读 |

不引：

| 不引 | 替代 | 理由 |
|---|---|---|
| Express / Fastify | Hono | 同语言、更小、TS 类型推断好；Express 已进维护期 |
| Prisma / Drizzle / Kysely | 手写 SQL + better-sqlite3 的类型映射 | 19 张表、SQL 简单；同步协议要精确控制 rev 自增与事务边界，ORM 反而挡路 |
| Redis | 无 | 缓存只有 geo_cache 与规则，都在 SQLite 里 |
| 消息队列 | job 表 + 轮询（10s） | 单人规模；要更低延迟就 SSE 推，不引 Kafka/RabbitMQ |
| Passport / JWT 库 | 自写 Bearer + sha256(token) + 配对码 | 鉴权逻辑不到 100 行，引库反而多一层黑箱 |
| dotenv | Node 24 的 --env-file | 少一个依赖 |
| TypeORM/Sequelize | — | 同上，太重 |

进程与端口：

~~~text
house-api    127.0.0.1:8787   仅被 openresty 反代，安全组不开
house-worker 无端口           只调 127.0.0.1:8787/internal/*，带 X-Internal-Token
~~~

## 6. 抓数 worker（services/worker）

| 项 | 值 |
|---|---|
| Python | 3.6 兼容语法（服务器现状） |
| 第三方依赖 | 无。只用标准库：urllib.request / json / sqlite3（不用，直连被禁）/ time / random / http.client |
| HTML 解析 | 标准库 html.parser + 正则目标字段；不引 bs4/lxml（3.6 上装 lxml 要编译） |
| 无头浏览器 | 不用 playwright/puppeteer（2C2G 上跑 Chromium 会打满内存）；拿不到就标记 needs_manual |
| 外部数据源 | 高德 Web 服务 API（地理编码 / 路径规划 / POI 周边） |
| 配额保护 | 令牌桶 4500/日 + geo_cache 60 天 TTL |
| 并发 | 单进程单线程，4.5 s 间隔。要快就多开 systemd 实例，不引 asyncio（3.6 的 asyncio 语法差异大） |
| 与 API 的契约 | POST /internal/jobs/claim 领任务 → POST /internal/jobs/:id/finish 交「写库意图」 |

为什么 Python 而不是全 Node：

1. 反爬三通道（安居客/C21/5i5j）的代码已在 app.py 里跑通，重写等于重踩坑。
2. Python 标准库的 http 与 html.parser 足够对付这三站，且不需要编译型依赖。
3. worker 与 API 的边界是 HTTP，不是语言——两边各自最优即可。

## 7. 数据层

| 端 | 引擎 | 关键 pragma |
|---|---|---|
| 桌面/移动 | rusqlite 0.37（bundled SQLite 3.45+） | journal_mode=WAL, synchronous=NORMAL, foreign_keys=ON, busy_timeout=5000 |
| 服务器 | better-sqlite3 12（内置 SQLite） | 同上 + 单进程单写者 |
| Web | 无 SQLite | Cache Storage 快照 + IndexedDB outbox（idb 手写，不引 Dexie） |

Schema 管理：

- 客户端：schema.sql 的 create ... if not exists 纪律（现状），加列走 migrations/000N_*.sql + pragma user_version。
- 服务端：同样手写 SQL 迁移，启动时检查 user_version 并顺序执行，失败则拒绝启动（不半迁移）。
- **只加列不删列、不改名**。回滚只切二进制，不切库。

数据类型约定（前后端一致，写进 packages/protocol）：

| 概念 | 表示 | 注意 |
|---|---|---|
| 时间 | ISO 8601 UTC 字符串（2026-11-13T05:31:02Z） | SQLite 存 text，不用 unix 秒 |
| 金额 | 元，integer（万元单位只在展示层换算） | 不用浮点存钱 |
| 布尔 | 0 / 1 integer | 不用 text 的 true/false |
| 标识 | 内部 id integer（本地句柄）+ uid text（跨端 UUIDv7） | 对外只认 uid |
| 评分 | 1–5 的 integer，null = 未评 | 不存 0，0 与「未评」必须可区分 |

## 8. 构建与工具链

| 项 | 值 | 说明 |
|---|---|---|
| 包管理 | pnpm 11.25 workspace | package.json 里加 packageManager 字段锁版本 |
| hoisted 设置 | nodeLinker: hoisted（现状，保留） | Tauri CLI 与 Android 构建对符号链接敏感，hoisted 少一类玄学 |
| TS 配置 | base + 各包 extends，paths 走 workspace 包名 | 不用 tsconfig 里相对路径穿越 |
| 别名 | @ → 各包 src | 与现状 vite alias 一致 |
| 构建命令 | tsc --noEmit && vite build | 类型不过不打包（现状） |
| 产物目标 | es2022 | minSdk 24 的 WebView 上安全 |
| 版本号 | 只写 package.json，前端读 __APP_VERSION__ | 避免写死后漂移（现状） |
| 代码风格 | 无 eslint / 无 prettier | tsc 严格模式 + 编辑器默认格式化已够；不引第二套规则系统 |
| 提交 | 不做 git hook | 单人项目，commit message 手写 |

Vite 配置里必须保留的三件事（都是踩过坑的）：

1. watch.ignored 排除 docs/、tools/、**/*.xlsx、design-demos/、*.tmp —— 这些文件被 Excel 或别的进程锁住时，watcher 注册就 EBUSY，dev server 直接崩。
2. server.port 1420 + strictPort，Android 真机的 HMR 走 1421。
3. build.target = es2022、minify = esbuild、sourcemap = false。

## 9. 质量与测试

| 层 | 工具 | 覆盖什么 |
|---|---|---|
| 纯函数单测 | Vitest | packages/core 的 scoring（品质分、房屋分、月供、税费、通勤折线）——这是全项目最该测的地方 |
| 同步逻辑 | Vitest + 内存 better-sqlite3 | outbox 重放、冲突裁决、墓碑、游标推进 |
| API | Vitest + Hono 的 app.request() | 路由 + zod 校验 + 鉴权 401 |
| 组件 | @testing-library/react（可选） | 只在表单校验复杂时用，不追覆盖率 |
| 端到端 | Playwright（仅 Web，仅关键路径） | 「打开 → 搜索小区 → 看详情 → 加待选 → 断网操作 → 恢复同步」 |
| 手测清单 | docs/ 里的检查表 | 三端各跑一遍：桌面 Windows、Android 真机、手机浏览器 |

不追覆盖率数字。**必须测的只有两处**：scoring 纯函数（错了会误导买房决策）与同步（错了会丢数据）。其余靠手测。

## 10. 部署与运维

| 项 | 选型 | 备注 |
|---|---|---|
| 反代 | openresty（机器现有） | /house-api/ → 127.0.0.1:8787；/ → /var/www/house |
| 静态资源 | 直接落盘 + immutable 缓存 + SPA fallback | 不上 CDN，一台机器 |
| 户型图 / 封面 | `services/api/assets/{huxing,covers}`，由 api 直出 `/huxing/*`、`/covers/*` | 不进前端包（48MB），页面用 `mediaUrl()` 拼地址 |
| 进程 | systemd（house-api / house-worker / house-backup.timer） | 不装 Docker |
| 部署通道 | 1Panel v1 HTTP API（SSH 22 外网封） | infra/deploy.sh 全自动；保留人工兜底 |
| 配置 | /opt/house/api.env（chmod 600） | 密钥不进口令行 |
| 日志 | pino JSON → journald | journalctl -u house-api -o cat 可直接 grep |
| 备份 | sqlite3 .backup 每小时，保留 48 份 | /var/backups/house/ |
| 异地 | rclone 到对象存储，每日 | 每季度做一次恢复演练 |
| TLS | 现有证书（openresty） | 到期前 30 天 rclone/脚本提醒 |

## 11. 版本策略

1. **锁大版本**：package.json 里用 ^（现状），真正的一致性靠 pnpm-lock.yaml 提交进仓库。
2. **Node / Rust / Android SDK 三者联动升级**：Tauri 升大版本时才顺带升 Rust 与 targetSdk，平时不动。
3. **每季度一个升级窗口**：pnpm up --latest 在一个分支上跑完三端 + 服务端 + 全量测试，不通过就回退，不追新。
4. **不追 canary / nightly / rc**：React 19 的 experimental、Vite 的 beta 一律不碰。
5. **Tauri 与 @tauri-apps/api 必须同版本**：混用会在 IPC 序列化上炸得莫名其妙。
6. **Python worker 不随大流升级**：服务器 3.6 是硬约束，只有整机迁移时才考虑 3.11。

## 12. 明确不用（一张表终结争论）

| 技术 | 为什么不用 |
|---|---|
| Next.js / Nuxt / Remix | 无 SEO、Tauri 里不可用、多一层构建与服务端渲染的心智负担 |
| Electron | 已有 Tauri，包体积 1/10，内存也少一半 |
| React Native / Flutter | UI 已是 Web，复用率 100%；重写等于推翻现有主题 |
| Capacitor | Tauri 已覆盖 Android，且能直接跑 Rust + rusqlite |
| Postgres / MySQL | 单家庭、万级行、单机；SQLite 备份就是复制文件 |
| Redis / Memcached | 无高频缓存需求；geo_cache 在库里 |
| Docker / K8s | 一台机器两个进程，systemd 足够；装了只是多一层排障 |
| GraphQL | 请求形态固定；增量同步用游标 REST 更直白 |
| WebSocket | 同步是拉取式；真要实时加 SSE，不引双向通道 |
| CRDT（Yjs/Automerge） | 冲突只有「人改的 vs 服务器抓的」，按表定赢家即可 |
| ORM（Prisma/Drizzle） | 要精确控制 rev 与事务边界，手写 SQL 更直接 |
| eslint / prettier | tsc strict + 编辑器默认格式化已够，少一套配置就少一处漂移 |
| Storybook | 组件不到 20 个，dev server 里直接看 |
| Sentry | 私人工具，日志进 journald 够用；出错看 /health 与客户端上报码 |
| 端到端加密 | 服务器要算分与抓数，必须看明文；靠 TLS + 单机 |
