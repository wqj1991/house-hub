#!/usr/bin/env bash
# 从备份恢复 house.db：停 API → 备份现库 → 解压替换 → 起 API → 自检。
# 用法：sudo bash infra/restore.sh /var/backups/house/house-20261113-032000.db.gz
set -euo pipefail

SRC="${1:?用法: restore.sh <house-*.db.gz>}"
DB="${HOUSE_DB:-/var/lib/house/house.db}"
SERVICE="${HOUSE_API_SERVICE:-house-api}"

[ -f "$SRC" ] || { echo "找不到备份：$SRC"; exit 2; }
gunzip -t "$SRC" || { echo "备份包已损坏：$SRC"; exit 2; }

echo "== 停 $SERVICE"
systemctl stop "$SERVICE"

if [ -f "$DB" ]; then
  SAFE="$DB.before-restore-$(date +%Y%m%d-%H%M%S)"
  echo "== 现库留底 → $SAFE"
  cp -a "$DB" "$SAFE"
fi

echo "== 解压覆盖 $DB"
gunzip -c "$SRC" > "$DB"
rm -f "$DB-wal" "$DB-shm"
chown "$(stat -c %U "$(dirname "$DB")")":"$(stat -c %G "$(dirname "$DB")")" "$DB"

echo "== 完整性检查"
sqlite3 "$DB" "pragma integrity_check;" | grep -qx ok || { echo "!! 恢复后完整性检查失败"; exit 1; }

echo "== 起 $SERVICE"
systemctl start "$SERVICE"
bash "$(dirname "$0")/healthcheck.sh"
