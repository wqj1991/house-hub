#!/usr/bin/env bash
# 服务器端发布（root 跑）：解包 → 装依赖 → 切 current → 同步静态 → 重启 → 自检 → 失败回滚。
# 用法：sudo bash /opt/house/current/infra/release.sh <STAMP> [KEEP]
set -euo pipefail

STAMP="${1:?用法: release.sh <STAMP> [KEEP]}"
KEEP="${2:-5}"
BASE="${HOUSE_BASE:-/opt/house}"
TARBALL="$BASE/incoming/house-$STAMP.tgz"
REL="$BASE/releases/$STAMP"
RUN_USER="${HOUSE_RUN_USER:-house}"
SERVICE="${HOUSE_API_SERVICE:-house-api}"
WEB_ROOT="${HOUSE_WEB_ROOT:-/var/www/house}"
PNPM="${HOUSE_PNPM:-$(command -v pnpm || echo /usr/bin/pnpm)}"

[ -f "$TARBALL" ] || { echo "找不到包：$TARBALL"; exit 2; }
[ -x "$PNPM" ] || { echo "找不到 pnpm：$PNPM（设 HOUSE_PNPM）"; exit 2; }

echo "== 解包 → $REL"
mkdir -p "$REL" "$BASE/releases"
tar xzf "$TARBALL" -C "$REL"
chown -R "$RUN_USER:$RUN_USER" "$REL"

# devDependencies 必须装：tsx 是 start 的启动器（--prod 会把 tsx 一起省掉，服务起不来）
echo "== 安装依赖"
sudo -u "$RUN_USER" env HOME="$BASE" "$PNPM" --dir "$REL" install --frozen-lockfile --reporter=silent

PREV="$(readlink -f "$BASE/current" 2>/dev/null || true)"
echo "== 切换 current（上一版：${PREV:-无}）"
ln -sfn "$REL" "$BASE/current.new"
mv -Tf "$BASE/current.new" "$BASE/current"

echo "== 同步静态文件 → $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete "$REL/apps/web/dist/" "$WEB_ROOT/"
chown -R "$RUN_USER:$RUN_USER" "$WEB_ROOT"

echo "== 重启 $SERVICE"
systemctl restart "$SERVICE"

echo "== 自检"
if bash "$REL/infra/healthcheck.sh"; then
  echo "OK：$STAMP 已上线"
else
  echo "!! 自检失败，回滚到 ${PREV:-（无上一版）}"
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$BASE/current.new"
    mv -Tf "$BASE/current.new" "$BASE/current"
    rsync -a --delete "$PREV/apps/web/dist/" "$WEB_ROOT/"
    systemctl restart "$SERVICE"
    bash "$REL/infra/healthcheck.sh" || echo "!! 回滚后仍不健康，人工介入"
  fi
  exit 1
fi

echo "== 清理旧版本（保留 $KEEP 份）"
ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
rm -f "$TARBALL"
