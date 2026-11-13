# infra

部署面：openresty 当着门，systemd 管进程，`deploy.sh` 在本机、`release.sh` 在服务器。

| 文件 | 在哪跑 | 作用 |
|---|---|---|
| `deploy.sh` | 本机（Windows git bash） | 构建 → 打包 → 上传 → 远程调 `release.sh` → 外网自检 |
| `release.sh` | 服务器（root） | 解包 → 装依赖 → 原子切 `current` → 同步静态 → 重启 → 自检 → **失败自动回滚** |
| `rollback.sh` | 服务器（root） | 手动切回上一个 release |
| `healthcheck.sh` | 服务器（任意） | `/health` + rev + 磁盘；`release.sh` 用它当发布闸门 |
| `backup.sh` | 服务器（house） | `sqlite3 .backup` 热备 + gzip + 保留 14 份 |
| `restore.sh` | 服务器（root） | 停服务 → 现库留底 → 解压覆盖 → 完整性检查 → 起服务 |
| `openresty/house.conf` | `/usr/local/openresty/nginx/conf/conf.d/` | 静态站 + `/house-api/` 反代 + 限流 |
| `systemd/*.service` `.timer` | `/etc/systemd/system/` | api 常驻、worker 每 2 分钟、备份每日 03:20 |

## 目录约定（服务器）

```
/opt/house/
  current -> releases/20261113-161500   # 软链，原子切换
  releases/<stamp>/                     # 每次发布解一份完整代码
  incoming/house-<stamp>.tgz            # deploy 传上来的包，发布成功即删
  api.env  worker.env                   # chmod 600，不进仓库也不进 tar
/var/lib/house/house.db                 # 唯一写者：house-api
/var/www/house/                         # 前端静态文件（rsync --delete）
/var/backups/house/house-*.db.gz
```

## 首次上线

```bash
sudo useradd -r -s /usr/sbin/nologin house || true
sudo install -d -o house -g house /opt/house /opt/house/releases /opt/house/incoming \
  /var/lib/house /var/www/house /var/backups/house

# pnpm 用 corepack 装到 PATH 里，systemd 才找得到（ExecStart=/usr/bin/env pnpm）
sudo corepack enable && sudo corepack prepare pnpm@11.25.0 --activate

# 两个 env 手工写，chmod 600；里面至少要有 HOUSE_INTERNAL_TOKEN
sudo install -m 600 -o house -g house /dev/null /opt/house/api.env
sudo install -m 600 -o house -g house /dev/null /opt/house/worker.env
#   api.env:    PORT=8787  HOST=127.0.0.1  HOUSE_DB_PATH=/var/lib/house/house.db  HOUSE_INTERNAL_TOKEN=...
#   worker.env: HOUSE_API=http://127.0.0.1:8787  HOUSE_INTERNAL_TOKEN=...（同一个值）

sudo cp infra/systemd/*.service infra/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now house-worker.timer house-backup.timer
# house-api 没有 current 之前起不来，先跑一次 deploy

sudo cp infra/openresty/house.conf /usr/local/openresty/nginx/conf/conf.d/
sudo openresty -t && sudo systemctl reload openresty
```

## 发布

```bash
HOUSE_HOST=1.2.3.4 HOUSE_PUBLIC_URL=https://house.example.com pnpm deploy
```

`deploy.sh` 用 `win-sshpass`（本仓 SSH 一律走它）。流程：

1. 本机 `pnpm install --frozen-lockfile` + `typecheck` + `version:check` + `build`——**构建只在本机做**，服务器不装构建链。
2. 打 `house-<stamp>.tgz`，排除 `node_modules` / `.git` / `.env` / `target`，**带上 `apps/web/dist`**。
3. `scp` 到 `/opt/house/incoming/`。
4. `sudo bash current/infra/release.sh <stamp>`：解包到 `releases/<stamp>`、装依赖、`ln -sfn` + `mv -Tf` 原子切链、rsync 静态、`systemctl restart house-api`、跑 `healthcheck.sh`。
5. 自检不过就切回上一版并重启，退出码非 0——不会留下半死不活的线上。
6. 保留最近 `HOUSE_KEEP`（默认 5）份 release。

## 回滚

```bash
sudo bash /opt/house/current/infra/rollback.sh            # 回到上一版
sudo bash /opt/house/current/infra/rollback.sh 20261113-090000   # 指定版本
```

数据库不动：代码回滚和库回滚是两件事，库要回滚走 `restore.sh`。

## 备份与恢复

```bash
sudo /opt/house/current/infra/backup.sh                     # 手动一份
sudo bash /opt/house/current/infra/restore.sh /var/backups/house/house-20261113-032000.db.gz
```

`backup.sh` 用 SQLite 的 `.backup`（WAL 下也一致）+ `pragma integrity_check`，坏包会被 `grep -qx ok` 拦住；`restore.sh` 会先把现库复制成 `house.db.before-restore-<ts>`，再解压覆盖。

## 为什么装 devDependencies

`services/api` 的 `start` 是 `tsx src/server.ts`，`tsx` 在 devDependencies 里。旧脚本 `pnpm install --prod` 会把它省掉，服务直接起不来——现在 `release.sh` **不带 `--prod`**。要改成纯 `node` 启动，得先把 API 预编译成 js（P3 之后再说）。

## 边界

- `/internal/*` 不经过 openresty，只有 127.0.0.1 能调；外网只能看到 `/house-api/` 下的公开路由。
- `/house-api/auth/` 单独限流 6r/m（`limit_req`），挡撞库；其余接口 20r/s。
- worker 不碰 `house.db`，只调 `/internal/*`，所以 `house-worker.service` 里 `ReadWritePaths` 只有 `/var/lib/house`（留给日志/临时文件）。
- 服务器装依赖要能编译 `better-sqlite3`：`python3`、`make`、`g++` 得有（Debian/Ubuntu 是 `build-essential`）；`pnpm install` 会走 `onlyBuiltDependencies` 里的原生构建。
- 前端静态文件用 `rsync --delete` 覆盖 `/var/www/house`，`current` 切到哪版就同步哪版——回滚时也会一起回。
