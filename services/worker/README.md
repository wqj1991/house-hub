# services/worker

抓数与重算的常驻/定时进程。**不碰数据库**，只调 `/internal/*`：

```
claim  → POST /internal/jobs/claim        （204 = 没活）
finish → POST /internal/jobs/:id/finish   （{ok, result, error}）
```

两端口令都走 `x-internal-token`，只在本机 127.0.0.1 暴露（openresty 不转 `/internal`）。

## 跑

```bash
export HOUSE_API=http://127.0.0.1:8787
export HOUSE_INTERNAL_TOKEN=...
python3 services/worker/worker.py --once     # systemd timer
python3 services/worker/worker.py            # 常驻轮询
```

## 约束

- Python 3.6 语法、只用标准库：线上机器是发行版自带的 python3，没有 bs4/playwright。
- 现有 handler 都是 stub：`community_fill` / `route_compute` 接单后回写 note，等 P3 接高德与成交明细。
  新增任务类型 = 加一个 `HANDLERS` 条目，服务端 `job.kind` 同名即可。
- 单个任务异常只让那个任务 failed，进程继续活着（`run_one` 里 try/except）。
