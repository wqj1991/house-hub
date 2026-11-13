#!/usr/bin/env bash
# 从本机把仓库推到服务器并滚一遍；失败不自动回滚，只把上一版路径打出来。
set -euo pipefail

HOST="${HOUSE_HOST:?HOUSE_HOST 未设置}"
DEST="${HOUSE_DEST:-/opt/house}"
REMOTE="${HOUSE_USER:-house}@$HOST"

echo "== 1/5 本地构建"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build

echo "== 2/5 同步代码（不动 .env / var）"
win-sshpass ssh "$REMOTE" "mkdir -p $DEST"
win-sshpass rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.env' --exclude 'dist' \
  ./ "$REMOTE:$DEST/"

echo "== 3/5 服务器安装依赖"
win-sshpass ssh "$REMOTE" "cd $DEST && pnpm install --frozen-lockfile --prod"

echo "== 4/5 发前端静态文件"
win-sshpass ssh "$REMOTE" "sudo mkdir -p /var/www/house && sudo rsync -a --delete $DEST/apps/web/dist/ /var/www/house/"

echo "== 5/5 重启 API 并自检"
win-sshpass ssh "$REMOTE" "sudo systemctl restart house-api && sleep 1 && curl -fsS http://127.0.0.1:8787/health"

echo "OK。回滚：git 回到上一版后重跑本脚本（库不动）。"
