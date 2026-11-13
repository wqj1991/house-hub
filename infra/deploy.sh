#!/usr/bin/env bash
# 本机滚一版到服务器：本机构建 → 打包 → 上传 → 服务器原子切换 → 自检 → 失败自动回滚。
# 依赖 win-sshpass（本仓 SSH 一律走它）；服务器侧逻辑在 infra/release.sh。
set -euo pipefail

HOST="${HOUSE_HOST:?HOUSE_HOST 未设置（服务器地址）}"
RUN_USER="${HOUSE_USER:-house}"
DEST="${HOUSE_DEST:-/opt/house}"
KEEP="${HOUSE_KEEP:-5}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE="$RUN_USER@$HOST"
TARBALL="house-$STAMP.tgz"
PUBLIC_URL="${HOUSE_PUBLIC_URL:-}"

cleanup() { rm -f "$TARBALL"; }
trap cleanup EXIT

echo "== 1/6 本地构建（构建只在本机做，服务器不装 devDependencies 也能跑）"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm version:check
pnpm build

echo "== 2/6 打包 $TARBALL"
# 带 dist：服务器只解包，不再自己 build。--exclude 用相对路径写法，避免把 apps/web/dist 也排掉。
tar czf "$TARBALL" \
  --exclude=./node_modules --exclude=./.git --exclude=./.env \
  --exclude=./var --exclude=./.target --exclude=./target \
  --exclude=./apps/shell/src-tauri/target \
  --exclude=./.vite --exclude=./coverage \
  ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml \
  ./apps/web ./packages ./services ./infra ./scripts ./docs ./README.md ./CONTRIBUTING.md

echo "== 3/6 上传"
win-sshpass ssh "$REMOTE" "mkdir -p $DEST/incoming"
win-sshpass scp "$TARBALL" "$REMOTE:$DEST/incoming/$TARBALL"

echo "== 4/6 服务器发布（release.sh 负责解包、装依赖、切链、重启、自检、回滚）"
set +e
win-sshpass ssh -t "$REMOTE" "sudo bash $DEST/current/infra/release.sh $STAMP $KEEP"
CODE=$?
set -e
if [ "$CODE" -ne 0 ]; then
  echo "!! 发布失败（退出码 $CODE）。release.sh 已尝试回滚；查日志："
  echo "   win-sshpass ssh $REMOTE 'journalctl -u house-api -n 80 --no-pager'"
  exit "$CODE"
fi

echo "== 5/6 本机回看 current"
win-sshpass ssh "$REMOTE" "readlink -f $DEST/current; systemctl is-active house-api"

echo "== 6/6 外网自检"
if [ -n "$PUBLIC_URL" ]; then
  curl -fsS --max-time 5 "$PUBLIC_URL/house-api/health" && echo
else
  echo "跳过（设 HOUSE_PUBLIC_URL=https://你的域名 可让本步真正打外网）"
fi

echo "OK。手动回滚：win-sshpass ssh $REMOTE 'sudo bash $DEST/current/infra/rollback.sh'"
