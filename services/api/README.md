# services/api

house.db 的唯一写者：Hono + better-sqlite3，只监听 127.0.0.1:8787，
对外由 openresty 把 `/house-api/` 反代进来（见 `infra/openresty/house.conf`）。

## 本地跑

```bash
cp .env.example .env          # 默认库放 D:/dsh/cache/house/house.db
pnpm install
pnpm --filter @house/api dev
curl http://127.0.0.1:8787/health
```

## 接口

路径一律取自 `@house/protocol` 的 `ApiRoutes`，不在别处手写第二遍。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | /health | 无 | 版本、全局 rev、小区数 |
| POST | /auth/pair | 配对码 | 6 位一次性码 → 设备 token |
| POST | /auth/refresh | 设备 | 换新 token（旧的立即失效） |
| POST | /auth/revoke | 设备 | 吊销本设备 |
| GET | /sync/pull | 设备 | `since` + 可选 `tables`，一页 500 行 |
| POST | /sync/push | 设备 | 批量 upsert/delete，返回 conflicts |
| GET | /communities | 设备 | 按 `q`/`district`/`limit` 搜 |
| GET | /communities/:uid | 设备 | 单个小区（也接受数字 id） |
| GET | /communities/:uid/transactions | 设备 | 成交明细（P3 才有数据） |
| GET | /rules | 设备 | 打分规则 + version/hash |
| POST | /community/fill | 设备 | 排一个抓数任务 |
| POST | /route/compute | 设备 | 排一个通勤重算任务 |
| GET | /jobs/:id | 设备 | 任务状态 |
| POST | /internal/jobs/claim | `x-internal-token` | worker 领活（204 = 没活） |
| POST | /internal/jobs/:id/finish | `x-internal-token` | worker 交活 |
| POST | /internal/pair/code | `x-internal-token` | 出一张 10 分钟配对码 |

## 出配对码

```bash
curl -s -XPOST http://127.0.0.1:8787/internal/pair/code \
  -H "x-internal-token: $HOUSE_INTERNAL_TOKEN"
```

## 目录

```
src/server.ts          装配 + 日志 + 错误出口
src/db.ts              开库、迁移、全局 rev
src/auth.ts            设备令牌 / 内网令牌
src/wire.ts            snake_case ↔ camelCase、列白名单
src/migrations/        手写 SQL，按 user_version 补跑
src/routes/*.ts        一个文件一组路由
```
