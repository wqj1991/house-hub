#!/usr/bin/env bash
# 手动回滚：把 current 切到上一个 release，重启并自检。
# 用法：sudo bash /opt/house/current/infra/rollback.sh [目标版本名]
set -euo pipefail

BASE="${HOUSE_BASE:-/opt/house}"
WEB_ROOT="${HOUSE_WEB_ROOT:-/var/www/house}"
SERVICE="${HOUSE_API_SERVICE:-house-api}"
CUR="$(readlink -f "$BASE/current")"

if [ "${1:-}" != "" ]; then
  TARGET="$BASE/releases/$1"
else
  TARGET="$(ls -1dt "$BASE"/releases/*/ | sed "s#/##" | grep -vx "$(basename "$CUR")" | head -1)"
fi

[ -d "$TARGET" ] || { echo "没有可回滚的版本：$TARGET"; exit 2; }
echo "current: $CUR"
echo "target : $TARGET"

ln -sfn "$TARGET" "$BASE/current.new"
mv -Tf "$BASE/current.new" "$BASE/current"
rsync -a --delete "$TARGET/apps/web/dist/" "$WEB_ROOT/"
systemctl restart "$SERVICE"
bash "$TARGET/infra/healthcheck.sh" || { echo "!! 回滚后不健康"; exit 1; }
echo "已回滚到 $(basename "$TARGET")"
