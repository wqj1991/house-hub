#!/usr/bin/env bash
# 本机自检：API 起来了、/health 通、库可读、磁盘没爆。release.sh 用它判断是否回滚。
set -uo pipefail

API="${HOUSE_API_URL:-http://127.0.0.1:8787}"
TRIES="${HOUSE_HEALTH_TRIES:-15}"
DB="${HOUSE_DB:-/var/lib/house/house.db}"
DISK_LIMIT="${HOUSE_DISK_LIMIT:-90}"

up=0
for _ in $(seq 1 "$TRIES"); do
  if body="$(curl -fsS --max-time 3 "$API/health" 2>/dev/null)"; then
    echo "health: $body"
    up=1
    break
  fi
  sleep 1
done
[ "$up" = 1 ] || { echo "!! $API/health 连续 $TRIES 秒无响应"; exit 1; }

if [ -f "$DB" ]; then
  rev="$(sqlite3 "$DB" "select rev from sync_counter" 2>/dev/null || echo "")"
  echo "rev: ${rev:-读不到（库刚建或权限不足）}"
fi

use="$(df -P "$(dirname "$DB")" 2>/dev/null | awk "NR==2{gsub(/%/,"");print $5}")"
if [ -n "${use:-}" ] && [ "$use" -ge "$DISK_LIMIT" ]; then
  echo "!! 磁盘占用 ${use}% ≥ ${DISK_LIMIT}%"; exit 1
fi
echo "disk: ${use:-?}%"
exit 0
