# ARCHITECTURE — 三端一后端（Web / 桌面 / 移动 + 服务器）

> 状态：提案（2026-11-13）。取代 docs/adr/0002-本地优先.md 中「没有服务端」那半句，
> 不取代「本地优先」本身。冲突记录见 adr/0005-多端一后端.md。
> 目标：同一份领域内核跑在浏览器、Tauri 桌面、Tauri Android 三个壳里；数据有唯一真源在服务器；
> 手机在看房现场断网时仍然能查、能打分、能勾清单。

## 0. 一句话

一套 React 前端 + 一套领域纯函数 + 两种数据驱动（本地 SQLite / HTTP）+ 一台服务器做同步中枢与抓数执行器。

不引入账号体系、不做多租户；服务器仍然是一台 VPS + 一个 SQLite 文件。

## 1. 现状盘点（事实，不是设想）

| 层 | 现在是什么 | 能不能直接长大 |
|---|---|---|
| 前端 | React 19 + TS 5.9 + Vite 7，7 个标签页 + 3 个压栈页，自研 Page[] 栈，无 router | 能，壳与页面解耦得好 |
| UI | 「悬浮纸」主题包，纯 CSS，宽度断点决定布局，与平台无关 | 能，三端共用一套 |
| 数据访问 | 19 个 Tauri 命令全部收口在 src/db.ts（149 行，页面只 import 这个模块） | 整次重构最大的资产 |
| 存储 | src-tauri/src/db.rs + schema.sql，15 张表，app_data_dir/house.db | 能，但要加 uid / rev / deleted_at |
| 服务器 | server/house_service/app.py（Python 3.6 零依赖），http://47.95.238.28/house-agent/，Bearer token | 能，定位从「补数脚本」升级为 worker |
| 构建 | vite build 出 dist/，Tauri 直接吃这个 dist | 能，Web 端就是同一个 dist |
| 多端 | 桌面 Windows 已验证；Android APK 6.7 MB 已出（scripts/android-apk.mjs） | 能，Web 端只差一个 RemoteRepo |

结论：不需要推倒重来。src/db.ts 已经是事实上的 Repository 层——把它从「函数集合」变成「接口 + 两个实现」，页面一行不改。

## 2. 目标架构

~~~mermaid
flowchart TB
  subgraph Clients["客户端：共用一套 React + packages/core"]
    W["Web 浏览器 / SPA 静态资源"]
    D["桌面 Tauri / Windows macOS"]
    M["移动 Tauri / Android iOS"]
  end

  subgraph Pkg["共享包 pnpm workspace"]
    CORE["packages/core / 类型 zod 打分纯函数 规则执行"]
    PROTO["packages/protocol / DTO 路由常量 同步信封"]
    DATA["packages/data / Repo 接口 + LocalRepo + RemoteRepo + SyncEngine"]
  end

  subgraph Srv["服务器"]
    NGX["openresty 反代 /house-api/ 转 8787"]
    API["services/api / Node 22 + Hono + better-sqlite3 / 唯一写者"]
    WRK["services/worker / Python 抓数 补数 高德批量"]
    DB[("house.db / SQLite WAL")]
  end

  W --> DATA
  D --> DATA
  M --> DATA
  DATA --> CORE
  DATA --> PROTO
  W -- "HTTPS /sync /community /route" --> NGX
  D -- "同协议" --> NGX
  M -- "同协议" --> NGX
  NGX --> API
  API --> DB
  API -- "internal API 127.0.0.1 + token" --> WRK
  WRK -- "只在 API 里写库" --> API
~~~

三条硬边界：

1. 只有 services/api 写 house.db。worker 通过 127.0.0.1/internal/* 领任务、交结果，不直连库。SQLite 只有一个写者，不存在 database is locked 的玄学。
2. 客户端不直连抓取源。安居客/C21/5i5j 只在 VPS 出口跑（ADR-0004 已定），改规则不发版。
3. packages/core 不含 IO。打分、折线、月供、税费、清单定义全是纯函数，浏览器/Node/测试三处同一份，规则结果不可能漂移。

## 3. 三个端，两套数据驱动

| 端 | 外壳 | 本地存储 | 数据通道 | 独有需求 |
|---|---|---|---|---|
| Web | 浏览器 | 只读快照缓存（Cache Storage）+ IndexedDB outbox | RemoteRepo 直连 API | URL 路由 #/community/123、导出/打印 |
| 桌面 | Tauri 2（Win/macOS/Linux） | app_data_dir/house.db（现有） | LocalRepo + SyncEngine | 批量导入导出、离线重算 |
| 移动 | Tauri 2（Android，iOS 待签名） | /data/data/com.househub.mobile/files/house.db | LocalRepo + SyncEngine | 离线优先、现场拍照（v2） |

为什么 Web 不跑 WASM SQLite：页面查询都是「列表 + 详情 + 勾选」，数据量 3000 小区 / 6.2 万成交。Web 端的正确解法是「服务端查 + 客户端缓存最近一次 pull 的快照（约 300 KB 轻量索引 + 命中详情）」，而不是把 30 MB 的 sqlite 塞进浏览器再为 OPFS 兼容性还债。

代价写清楚：Web 端断网只能读到上次同步过的数据，不能本地全文搜索新增内容；App/桌面断网时是全功能。将来 Web 真要全离线，packages/data 加一个 WebSqliteRepo（wa-sqlite + OPFS）即可，页面不动——这就是接口层的意义。

## 4. 目录结构（目标态）

~~~text
house/
├─ apps/
│  ├─ web/                    Vite SPA，产物 = 静态 dist（服务器 /var/www/house）
│  │  ├─ index.html
│  │  └─ src/{pages,components,styles,lib}    ← 现 src/ 原样搬入
│  └─ shell/                  Tauri 2（desktop + android），复用 apps/web 的 dist
│     ├─ src-tauri/{src,schema.sql,capabilities,tauri.conf.json}
│     └─ package.json         devUrl 1420, frontendDist ../web/dist
├─ packages/
│  ├─ core/                   纯函数，零 IO
│  │  ├─ domain/{community,house,person,shortlist}.ts
│  │  ├─ scoring/{quality,house,money,commute,jifen}.ts   ← 现 lib/*.ts 迁入
│  │  ├─ content/{guide,checks}.ts                        ← md / 清单文案
│  │  └─ schema.ts            zod：DTO 校验，前后端共用
│  ├─ protocol/               SyncEnvelope / ApiRoutes / 错误码
│  ├─ data/                   Repo 接口 + local + remote + sync
│  │  ├─ repo.ts              interface HouseRepo
│  │  ├─ local.ts             走 Tauri invoke（现 src/db.ts 的实现）
│  │  ├─ remote.ts            走 fetch
│  │  ├─ outbox.ts            写队列 + 重放
│  │  └─ index.ts             getRepo()：按 inTauri 选择
│  └─ ui/                     主题包 tokens/base/components/shell/glass + shadcn 原语
├─ services/
│  ├─ api/                    Node 22 + Hono + better-sqlite3
│  │  ├─ src/{server,routes,auth,sync,db,migrations}
│  │  └─ package.json
│  └─ worker/                 Python（现 server/house_service/app.py 演化为 job 执行器）
│     ├─ worker.py            领任务循环
│     ├─ jobs/{fill,route,crawl,shuttle}.py
│     └─ providers/           高德 / 反爬三通道（luohu 遗产）
├─ infra/
│  ├─ openresty/house.conf    /house-api/ 转 127.0.0.1:8787
│  ├─ systemd/{house-api.service,house-worker.service,house-backup.timer}
│  ├─ backup.sh               sqlite3 .backup + 保留 48 份
│  └─ deploy.sh               走 1Panel HTTP API 上传（SSH 22 被封）
└─ docs/
~~~

迁移节奏：不要求一次搬完。v0.2 先在根目录建 src/data/ + server/api/，v0.3 再拆 workspace。目录图是终点不是起点，见 §11。

## 5. 数据访问层：一个接口，三个实现

packages/data/repo.ts——页面唯一认得的东西（签名与现在 19 个命令一一对应，新增只有 sync 与 rules）：

~~~ts
export interface HouseRepo {
  status(): Promise<DbStatus>;
  searchCommunities(q: string, limit?: number): Promise<Community[]>;
  getCommunity(id: number): Promise<Community | null>;
  upsertCommunity(input: { name: string; district?: string }): Promise<number>;
  listShortlist(): Promise<Community[]>;
  addShortlist(communityId: number, note?: string): Promise<void>;
  removeShortlist(communityId: number): Promise<void>;
  listQuality(communityId: number): Promise<QualityRow[]>;
  setQuality(communityId: number, itemKey: string, valueNum: number | null,
             valueText: string | null, source?: string): Promise<void>;
  listChecks(): Promise<CheckRow[]>;
  setCheck(kind: string, itemKey: string, checked: boolean, note?: string): Promise<void>;
  getSettings(): Promise<Record<string, string>>;
  putSetting(key: string, value: string): Promise<void>;
  listLines(): Promise<ShuttleLine[]>;
  listHouses(communityId: number): Promise<HouseRow[]>;
  getHouse(id: number): Promise<HouseDetail | null>;
  saveHouse(h: HouseInput): Promise<number>;
  deleteHouse(id: number): Promise<void>;
  setHouseScore(houseId: number, itemKey: string, score: number): Promise<void>;
  setHouseRedline(houseId: number, itemKey: string, hit: boolean): Promise<void>;
  // 新增：与服务器对齐
  sync(): Promise<SyncReport>;   // Local: 推 outbox + 拉增量；Remote: noop
  rules(): Promise<RuleSet>;     // score_rule 全集 + version + hash
}
~~~

getRepo() 的判定只在一处：

~~~ts
// packages/data/index.ts
import { LocalRepo } from "./local";
import { RemoteRepo } from "./remote";

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let repo: HouseRepo | null = null;
export function getRepo(): HouseRepo {
  if (!repo) repo = inTauri ? new LocalRepo() : new RemoteRepo();
  return repo;
}
~~~

local.ts 里必须动态 import Tauri 的 invoke：

~~~ts
let invoke: typeof import("@tauri-apps/api/core").invoke | null = null;
async function ipc<T>(cmd: string, args: unknown): Promise<T> {
  if (!invoke) invoke = (await import("@tauri-apps/api/core")).invoke;
  return invoke<T>(cmd, args as Record<string, unknown>);
}
~~~

否则 Web 构建产物里会同时塞进 Tauri 的 IPC 实现，白多 40 KB 且少一层可摇树。

页面改造量：所有 import { searchCommunities } from "@/db" 改成 getRepo().searchCommunities(...)。建议先保留 @/db 作为薄转出层（export const searchCommunities = (...a) => getRepo().searchCommunities(...a)），页面 0 改动先跑通，再逐步换。

## 6. 同步协议

### 6.1 为什么不是「直连 API 就完事」

手机在看房现场：地下室、电梯、老小区，信号是常态问题。现场要做的正是「勾红线、记清单、打分、写备注」——都是写操作。写失败等于这个功能不存在。所以桌面与移动保留本地 SQLite，服务器是同步对象，不是唯一读源。

### 6.2 行标识：uid 而不是自增 id

离线创建的记录必须在客户端就能定身份，否则两端各自 auto_increment 必然撞车。

- 每张可写表加 uid TEXT NOT NULL UNIQUE（UUIDv7，客户端生成，天然有序）。本地 id INTEGER PRIMARY KEY 保留为内部句柄，跨端只认 uid。
- 迁移：update <表> set uid = lower(hex(randomblob(16))) where uid is null; 一次性完成，老数据无痛。

### 6.3 三个字段 + 一个墓碑

~~~sql
alter table community add column uid        text;
alter table community add column rev        integer not null default 0;  -- 服务器单调递增
alter table community add column updated_at text;
alter table community add column deleted_at text;                        -- 墓碑，非物理删除
create unique index if not exists ux_community_uid on community(uid);
create index if not exists ix_community_rev on community(rev);
~~~

服务器维护 sync_counter(rev)，每次写入 rev = ++counter。拉取就是 where rev > ? order by rev asc limit 500，游标 = 最后一条的 rev。不需要时钟同步、不需要向量时钟。

### 6.4 两条路由

~~~http
GET  /api/sync/pull?since=10231&tables=community,community_quality,route,line,stop,score_rule
200 { "rev": 10877,
      "rows":    { "community": [ ... ], "community_quality": [ ... ] },
      "deleted": { "shortlist": ["uid-1", "uid-9"] },
      "more": true }

POST /api/sync/push
{ "device_id": "dev_7f2a", "items": [
    { "table": "shortlist", "uid": "u-abc", "op": "upsert",
      "fields": { "community_uid": "c-123", "note": "南向三居" },
      "base_rev": 0, "client_ts": "2026-11-13T05:31:02Z" },
    { "table": "check_state", "uid": "u-def", "op": "upsert",
      "fields": { "kind": "redline", "item_key": "R07", "checked": 1 } }
] }
200 { "applied": [ { "uid": "u-abc", "rev": 10878 } ],
      "conflicts": [ { "uid": "u-def", "winner": "client", "rev": 10879 } ],
      "rev": 10879 }
~~~

客户端 SyncEngine 的循环（伪码）：

~~~ts
async function tick() {
  if (!navigator.onLine) return;
  const out = await outbox.peekAll(200);          // 本地 _outbox 表
  if (out.length) {
    const r = await api.push(out);
    await outbox.ack(r.applied);
    await outbox.resolve(r.conflicts);            // 服务器说谁赢就落谁
  }
  let since = await meta.get("rev");
  for (;;) {
    const page = await api.pull(since, TABLES);
    await local.applyPage(page);                  // 单事务，upsert + 墓碑
    since = page.rev; await meta.set("rev", since);
    if (!page.more) break;
  }
}
// 触发：启动、每 60s、窗口聚焦、写操作后 debounce 5s、网络恢复事件
~~~

落地状态（2026-11-13，见 ADR 0006）：`applyPage` 已实现——Tauri 走 `apply_sync_page`（lib.rs，单事务 + 墓碑 + `sync_meta.rev`），Web 走 IndexedDB 快照（`packages/data/src/snapshot.ts`）。循环加了防截断守卫 `if (!page.more || page.rev <= since) break;`，`MAX_PAGES = 20`。

### 6.5 冲突：按表的「字段所有权」定赢家，不写通用 CRDT

单家庭、两个人、几台设备，冲突几乎只有两类：「人改的」vs「服务器抓的」。规则写死一张表：

| 表 | 谁赢 | 依据 | 备注 |
|---|---|---|---|
| community 抓取字段（price / price_tx / tx_n / bargain / cycle_days / lng / lat / build_year） | server | 抓取时间 | 客户端不写这些字段（读写分离） |
| community 人工字段（tags / online / address） | client | client_ts LWW | 服务器抓取时不清空人工字段 |
| community_quality 且 source = manual:* | client | client_ts LWW | 手工覆盖视为权威，抓取不覆盖 |
| community_quality 其余 | server | fetched_at | 带 evidence，见 ADR-0004 |
| shortlist / check_state / app_setting / jifen | client | client_ts LWW | 纯人的判断 |
| house / house_score / house_redline | client | client_ts LWW | 现场打分 |
| route / line / stop / score_rule | server | 只读下发 | 客户端上送视为非法，丢弃 |
| person / anchor / mode | client | client_ts LWW | 人设，不是抓取结果 |

client_ts 只用于同表两客户端之间比较，不做跨端因果推理；漂移超过 5 分钟由服务器在 push 响应里回 clock_skew 并校正。

### 6.6 首次装载

pull?since=0 一次吐出 3000 小区 + 6.2 万成交。成交明细不进同步集合（只在需要时 GET /community/:uid/transactions?limit=120 现取）。同步集合只含：community 摘要、community_quality、route、line、stop、score_rule 与本人的写表。预计首包 < 2 MB（gzip < 400 KB）。

## 7. 服务器 API

### 7.1 路由表

| 方法 | 路径 | 用途 | 鉴权 |
|---|---|---|---|
| GET | /health | 存活 + db.rev + job backlog | 无 |
| POST | /auth/pair | 配对码 换 设备令牌 | 配对码 |
| POST | /auth/refresh | 换发 access token | 设备令牌 |
| POST | /auth/revoke | 撤销某设备 | 已登录设备 |
| GET | /sync/pull | 增量拉取 | Bearer |
| POST | /sync/push | 批量写入 | Bearer |
| GET | /communities?q=&district=&limit= | 搜索（Web 主路径） | Bearer |
| GET | /communities/:uid | 详情（含质量分项） | Bearer |
| GET | /communities/:uid/transactions | 成交明细（不进同步集） | Bearer |
| GET | /rules | score_rule 全集 + version + hash | Bearer |
| POST | /community/fill | 提交补数任务，返回 job_id | Bearer |
| POST | /route/compute | 提交通勤重算任务，返回 job_id | Bearer |
| GET | /jobs/:id | 任务状态 + 结果摘要 | Bearer |
| POST | /internal/jobs/claim | worker 领任务 | X-Internal-Token |
| POST | /internal/jobs/:id/finish | worker 交结果（含写库意图） | X-Internal-Token |

旧路径 http://47.95.238.28/house-agent/community/fill 保留 6 个月，内部转发到新的任务化实现；客户端切完再关。

### 7.2 鉴权：配对码，不是账号

D3「不做账号体系」= 不做注册/找回密码/多租户/角色权限。多端要认人，只需要「设备加入这个家庭」：

~~~text
Web（已配对设备） 我的页 设备 生成配对码   6 位数字，5 分钟有效，一次性
App 首次启动 输入配对码 POST /auth/pair {code, device_name, platform}
              返回 {device_token, household_id, rev}
之后 Authorization: Bearer <device_token>
~~~

- device(id, name, platform, token_hash, created_at, last_seen, revoked)，token_hash = sha256(token)，库里不存明文。
- 桌面/移动把 token 存进系统钥匙串（Tauri plugin-store 加密，或 tauri-plugin-stronghold）。
- Web 同源部署，token 放 httpOnly; Secure; SameSite=Lax cookie，前端不碰。
- 撤销 = 一行 revoked=1，下次请求 401，客户端提示重新配对。
- 令牌失效的恢复路径（换库/撤设备/换服务器都会走到）：`api()` 见 401 就回调 `setUnauthorizedHandler`，Web 端清掉本地死凭证 → 界面回到「未连接」；同步面板的配对码输入框**常显**，已连接时叫「更换令牌」，另有「清除本机令牌」只清本机。数据导入不改 device 表（`infra/keep-devices.mjs` 从被覆盖的旧库搬回），设备跟着服务器走、不跟着数据快照走。

### 7.3 服务端选型：为什么是 Node + SQLite，不是 Postgres + 一堆容器

| 决策 | 选择 | 理由 | 何时反悔 |
|---|---|---|---|
| 运行时 | Node 22 + Hono + better-sqlite3 | 与前端同一语言，packages/core 与 zod schema 直接复用；Hono 无依赖、10 KB 级 | 要长连接推送 加 SSE，不换框架 |
| 主库 | SQLite（WAL） | 3000 小区 / 6 万成交 / 单人家庭；备份 = 复制一个文件；2C2G 富余 | 并发写 > 10/s 或多租户 迁 Postgres（接口已抽象） |
| 抓数 | Python 3.6 + 标准库（现有） | 反爬三通道、requests/bs4 生态、app.py 已验证 | 要浏览器渲染 加 playwright，仍在 worker 内 |
| 反向代理 | 现有 openresty | 机器上已有，1Panel 在管，不新增组件 | 要自动 TLS 换 Caddy 或加 certbot |
| 进程管理 | systemd | 机器上已有 1Panel，不装 Docker 也够 | 要一键复制环境 用 compose |
| 部署通道 | 1Panel HTTP API（SSH 22 外网被封） | 唯一可用通道 | 开了 SSH 直接 rsync |

默认端口：API 8787（不出安全组，只被 openresty 转发）；worker 无端口。

## 8. 数据模型增量

~~~sql
-- 设备与配对
create table if not exists device (
  id         text primary key,            -- dev_ulid
  name       text not null,
  platform   text not null,               -- web | windows | macos | android | ios
  token_hash text not null,
  created_at text not null default (datetime('now')),
  last_seen  text,
  revoked    integer not null default 0
);

-- 全局单调版本
create table if not exists sync_counter (rev integer not null);
insert into sync_counter(rev) select 0 where not exists (select 1 from sync_counter);

-- 抓数/重算任务队列（worker 的唯一入口）
create table if not exists job (
  id          text primary key,           -- job_ulid
  kind        text not null,              -- fill_community | route_compute | crawl_district | shuttle_import
  payload     text not null,              -- JSON
  status      text not null default 'queued',  -- queued running done failed cancelled
  attempts    integer not null default 0,
  worker      text,
  result      text,
  error       text,
  created_at  text not null default (datetime('now')),
  started_at  text,
  finished_at text
);
create index if not exists ix_job_status on job(status, created_at);

-- 规则版本（客户端启动校验）
create table if not exists rule_set (
  version    integer primary key,
  hash       text not null,               -- sha256(canonical json of score_rule)
  note       text,
  created_at text not null default (datetime('now'))
);

-- 高德配额与缓存（省配额，60 天 TTL）
create table if not exists geo_cache (
  cache_key  text primary key,            -- sha256(mode|from|to|profile)
  minutes    real,
  payload    text,
  fetched_at text not null default (datetime('now'))
);
~~~

已有 15 张表全部保留，只加 uid / rev / updated_at / deleted_at 四列（check_state 主键是 (kind,item_key)，加 uid 后仍以业务键去重）。不重建表、不改列名；schema.sql 的 create ... if not exists 纪律继续有效，新增列走 migrations/000N_*.sql 顺序执行并记 pragma user_version。

## 9. 抓数与重计算流水线

~~~text
[app / web]  POST /community/fill {name,district?}                     -> {job_id}
             POST /route/compute {community_uids, person_ids, modes}   -> {job_id}
                                   |
                             job 表（queued）
                                   |  worker 每 10s claim
                                   v
[worker]  fill_community:
            1. 高德 POI/地理编码：坐标、到站步行距离、周边 POI 计数
            2. 反爬三通道（安居客 / C21 / 5i5j，4.5s 限速、iPhone UA、cookie）
            3. 拿不到 模型补（必须带 evidence，confidence <= 0.9，否则写 null）
            4. finish 后由 API 写 community_quality（source/fetched_at/evidence）并 rev++
          route_compute:
            1. 命中 geo_cache 直接用（60 天）
            2. 否则调高德路径规划，令牌桶 4500/日（超限排队，不失败）
            3. finish 后由 API 写 route 表
~~~

三条工程纪律：

- worker 永远不决定分数。只写「原始值 + source + confidence + evidence」，1–5 分由 packages/core/scoring/quality.ts 现算（ADR-0004 原样延续）。
- job 幂等：同一 kind + payload hash 在 10 分钟内重复提交返回既有 job_id，不新建。
- 失败可重放：attempts < 3 自动回 queued，第 3 次 failed 并在 app 里显示原因。

## 10. 部署拓扑与运维

~~~text
47.95.238.28
├─ openresty :80/:443
│   ├─ /             -> /var/www/house/     apps/web/dist，immutable 缓存 + SPA fallback
│   ├─ /house-api/   -> 127.0.0.1:8787      services/api
│   └─ /house-agent/ -> 127.0.0.1:8788      旧 Python，过渡期保留
├─ systemd
│   ├─ house-api.service      EnvironmentFile=/opt/house/api.env（600）
│   ├─ house-worker.service   依赖 api 就绪，Restart=always
│   └─ house-backup.timer     每小时
└─ /var/lib/house/house.db    WAL + /var/backups/house/*.db（保留 48 份）
~~~

- 发布：infra/deploy.sh 构建 dist 走 1Panel /api/v1/files/upload 上传，/files/save 写 systemd unit，触发重启任务，轮询 /health 直到 db.rev 可读。全程无 SSH。
- 回滚：保留上一版 dist（/var/www/house.prev）+ 只加列不删列，回滚只切软链。
- 备份：sqlite3 house.db ".backup /var/backups/house/$(date +%F_%H).db"，每日 rclone 到对象存储；每季度一次恢复演练。
- 观测：pino JSON 进 journald；/health 返回 rev、jobs 计数、devices、lastSync；客户端上报 sync 失败 code，30 天聚合看一次就够。

## 11. 迁移路线（每一步都能独立上线）

| 阶段 | 做什么 | 改动面 | 验收 |
|---|---|---|---|
| P0 抽接口（1–2 天） | 建 src/data/repo.ts + local.ts，把 src/db.ts 改成薄转出层 | 只加文件，页面 0 改动 | tsc --noEmit 通过；pnpm build 体积波动 < 5 KB；7 个标签页全部可用 |
| P1 只读 API + Web（3–5 天） | services/api 起 /communities、/communities/:uid、/rules、/health；remote.ts 实现只读；导出 house.db 灌服务器（加 uid/rev） | 新增服务；Web 首次可用 | 手机浏览器访问线上地址，能搜到 2761 个小区并看详情；首屏 < 2 s |
| P2 同步（1 周） | _outbox、rev 列、/sync/pull 与 push、配对与设备、SyncEngine 接桌面/移动 | 数据层 + 一次迁移 | 桌面勾一条红线，手机 5 s 内可见；断网勾 3 条联网后自动补齐；重复 push 不产生重复行 |
| P3 抓数上云（1 周） | job 表 + worker.py + /community/fill 任务化；app 删除直连 house-agent 的 fill | 前端 lib/fill.ts 改为「提交 + 轮询」 | 从 app 发起补数，服务器跑完，客户端 pull 到带 evidence 的分项；重复提交返回同一 job_id |
| P4 拆 workspace（按需） | 按 §4 拆 apps/* + packages/*；packages/core 承接全部纯函数 | 目录 + import 路径 | 三端 pnpm build 全绿；桌面/安卓产物大小无回归 |
| P5 收尾（按需） | 规则版本校验、诊断页、Web URL 路由、iOS 签名 | — | 规则 hash 不匹配时客户端明确提示，不静默出旧分 |

P0/P1 收益最高、风险最低，建议先做；P4 可以最后做，因为 src/data 已经把边界划好了。

## 12. 明确不做

| 不做 | 理由 |
|---|---|
| 账号注册 / 密码找回 / 多租户 | 单家庭（D3）；配对码已覆盖多端 |
| Next.js / SSR | 无 SEO 需求；Tauri 里不可用；多一层构建 |
| GraphQL | 请求形态固定；增量同步用游标 REST 更直白 |
| Postgres / Redis / 消息队列 | 单人家庭、万级行；一个 SQLite + 一个 job 表解决 |
| CRDT / 自研 OT | 冲突只有「人 vs 抓取」一类，按表定赢家就够 |
| Electron | 已有 Tauri，包体积 1/10 |
| React Native | UI 已是 Web，Tauri 复用率 100% |
| 端到端加密 | 服务器要算分与抓数；靠 TLS + 单机 |
| Web 端跑 SQLite-WASM | 在线优先；接口层已留口子 |

## 13. 风险与对策

| 风险 | 触发条件 | 对策 |
|---|---|---|
| SQLite 写锁冲突 | worker 与 api 同时写 | 只有 api 写；worker 走 internal API；busy_timeout=5000；BEGIN IMMEDIATE |
| 高德配额打爆 | 全量重算 600+ 次 × 反复调试 | geo_cache 60 天 + 令牌桶 4500/日 + 批量合并 |
| 反爬封 IP | 抓取频率过高 | 单 VPS 出口、4.5 s 限速、夜间窗口、规则热改 |
| 客户端版本漂移 | 老 APK 用旧规则算分 | /rules 带 hash + min_client_version；不匹配时页面黄条公示 |
| 配对码泄露 | 6 位数字被猜 | 5 分钟 + 一次性 + 同 IP 5 次失败锁 15 分钟；生成配对码需已登录设备 |
| Web 离线不可写 | 浏览器断网 | 写操作进 IndexedDB outbox，恢复后重放；页面显示「待同步 N 条」 |
| 1Panel 通道不稳 | API 改动 | deploy.sh 保留人工兜底：导出 dist + db 快照手工上传 |
| 数据只在一台机器 | 磁盘故障 | 每小时快照 + 每日异地；恢复演练写进 runbook |

## 14. 与既有 ADR 的关系

| ADR | 状态 | 说明 |
|---|---|---|
| 0001 积分不进排序 | 有效 | 纯领域决策，与本架构无关 |
| 0002 本地优先 | 部分取代 | 「没有服务端」被取代；「本地优先、离线可用」保留并强化（见 0005） |
| 0003 UI 用悬浮纸主题包 | 有效 | 主题包零构建，天然跨端 |
| 0004 补数放服务器、证据入字段 | 有效，被放大 | 从一个 py 文件升级为 worker + job 队列，规则不变 |
| 0005 多端一后端 | 有效 | 一台同步中枢 + Web 端 RemoteRepo；本地优先不变 |
| 0006 同步落库与本地 rev 归属 | 有效 | rev 存 `sync_meta` 不同步；`apply_sync_page` 单事务；Web 落 IndexedDB 快照 |