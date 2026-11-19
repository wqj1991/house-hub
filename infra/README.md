# infra

部署面：openresty 当着门，systemd 管进程。

**这台服务器（47.95.238.28）SSH 22 从外网不可达**，所以 `deploy.sh`/`release.sh` 那套 SSH 流程只在远端机器上有意义。

- 代码已经在这台生产机上（`/root/house-hub`）：用 `deploy-local.sh` 本机直发，不联网不碰 1Panel，见「发布（本机直发）」。
- 代码在别处 / CI 里：走 `deploy-1panel.mjs` 的 1Panel v1 HTTP API（上传 + 计划任务跑 shell）。

| 文件 | 在哪跑 | 作用 |
|---|---|---|
| `deploy-local.sh` | **服务器（root，推荐）** | 构建 → 落 release → 装依赖 → 切 `current` → 同步静态 → 重启 → 自检 → **失败自动回滚** |
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

## 发布（本机直发，推荐）

代码就在这台生产机上时，不需要打包/上传/1Panel——`deploy-local.sh` 直接发：

```bash
sudo pnpm deploy:local                 # 构建 → 落 releases/<stamp> → 装依赖 → 切 current → 同步静态 → 重启 → 自检
sudo bash infra/deploy-local.sh --skip-build   # 已有 apps/web/dist（只改了后端）
sudo bash infra/deploy-local.sh --no-web       # 只发 API，不动 nginx 静态目录
sudo bash infra/deploy-local.sh --restart      # 只重启 + 自检
```

- 源码树默认 `/root/house-hub`（`HOUSE_SRC` 可改），产物落 `/opt/house-hub/releases/<stamp>`，`current` 软链原子切换。
- 构建用 `HOUSE_WEB_BASE=/house/`，产物资源必须是 `/house/assets/*`——脚本里会先校验，base 配错直接失败。
- 静态文件 `rsync --delete` 到 `/opt/1panel/apps/openresty/openresty/www/house`（openresty 在容器里，这里只写文件即可）。
- 自检不过自动切回上一版并重启；成功则清理旧版（`HOUSE_KEEP`，默认 4），并写 `/opt/house-hub/.last-deploy.json`（stamp / git rev / 未提交改动数）。
- 依赖：`rsync`、`pnpm`、`python3`+`make`+`g++`（`better-sqlite3` 原生构建）。

## 发布（远端打包上传，旧路径）

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
## HTTPS 站点 18766（页面 + API 同端口）

1Panel 站点 `house-hub`（`conf/conf.d/house-hub.conf`，快照见 `infra/openresty/house-hub-18766.conf`）：

- `listen 18766 ssl http2`，证书是 **Let's Encrypt IP 证书**（SAN=IP 47.95.238.28，只签发 6 天，到期前必须续）
- `location ^~ /` → `root /www/house`：**根路径直接出前端页面**（SPA 深链回落 `/house/index.html`）
- `location ^~ /house/` → `root /www`：同样一份产物按 `/house/` 挂载，兼容 base=/house/ 产物的资源路径
- `location ^~ /house-api/` → `proxy_pass http://127.0.0.1:8766/`（结尾斜杠剥前缀）：**后端只有这个前缀**
- 原来 1Panel 生成的 `include /www/sites/house-hub/proxy/*.conf`（`location ^~ /` 全量反代 8766）必须删掉，否则根路径会被吃成接口
- 前端调接口用的是绝对 `/house-api/...`（`apps/web/src/lib/session.ts`），所以同一份产物在根路径和 /house/ 下都能正确打接口

改配置后的生效方式（openresty 跑在容器里，宿主机没有 openresty 二进制）：

```bash
docker exec 1Panel-openresty-OLgm openresty -t
docker exec 1Panel-openresty-OLgm openresty -s reload
```

面板里再「保存」这个站点会把手工加的 `location ^~ /house/` 两段冲掉，需要重新贴回。

## 打标签自动发布（GitHub Actions）

推 `v*` 标签即触发两条流水线，互不阻塞：

| 工作流 | 产物/动作 |
|---|---|
| `.github/workflows/deploy.yml` | 构建前端（`HOUSE_WEB_BASE=/house/`）→ `deploy-1panel.mjs --skip-build --no-data --with-web`：上传、切 `current`、同步静态到 `/www/house`、重启 `house-hub-api`、自检 health + 页面 + 哈希资源 |
| `.github/workflows/release.yml` | 桌面端（Windows msi/nsis）、安卓 arm64 APK（有 keystore secrets 则签名）→ 发布 GitHub Release，附 `SHA256SUMS` |

两条都要求仓库 secret **`ONEPANEL_KEY`**（面板设置 → API 接口的 key）。没有它 deploy 会在第一次 API 调用就失败。
页面路径是 `/house/`（openresty `root /www`），所以前端构建必须带 `HOUSE_WEB_BASE=/house/`；桌面端/安卓端不要带，Tauri 走自定义协议根路径。

## 实际通道：1Panel（本机 → 47.95.238.28）

```bash
node infra/deploy-1panel.mjs              # 构建 → 打包 → 上传 → 带数据切链 → 重启 → 自检
node infra/deploy-1panel.mjs --no-data    # 只发代码，不动线上库
node infra/deploy-1panel.mjs --skip-build # 复用现有 apps/web/dist
node infra/deploy-1panel.mjs --restart    # 只重启 house-hub-api
node infra/deploy-1panel.mjs --with-web   # 顺带把 dist 同步到 nginx 静态目录（默认不碰）
```

- Key：`ONEPANEL_KEY` / `ONEPANEL_API_KEY` 环境变量，或 `~/.1panel_key`（1Panel → 面板设置 → API 接口）。
- 传输：`/api/v1/files/upload`；远端执行：`/api/v1/cronjobs/update` + `/cronjobs/handle`（cron id 2 当 shell 槽位），输出回读 `/api/v1/files/content`。
- 端口：API 监听 **8766**（`/opt/house-hub/api.env` 的 `PORT`，反代 `/house-api/` → 8766）。改端口只动 api.env + 反代，`deploy-1panel.mjs` 从 api.env 读，不写死。
- 服务器布局：`/opt/house-hub/{current,releases,incoming,logs,api.env}`，库 `/var/lib/house/house.db`，服务 `house-hub-api.service`（tsx 直跑 `services/api/src/server.ts`，node 固定在 `/root/.nvm/versions/node/v24.21.0/bin/node`）。
- 依赖：**不能在服务器上硬链上一版 node_modules**——pnpm 只往根 `node_modules` 建 `.pnpm`，各 package 的链接是相对软链；服务器 store 已有货，一律 `pnpm install --frozen-lockfile --offline`。
- 数据：本机 `VACUUM INTO` 出的一致快照上传后，停服 → 现库留底 `house.db.bak-<stamp>` → 覆盖 → 起服 → 自检；库里带 `user_version`，迁移随服务启动补跑。
- 反代/静态站点不归这个脚本管（`--with-web` 只覆盖 `/opt/1panel/apps/openresty/openresty/www/house/`）。