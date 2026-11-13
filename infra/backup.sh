#!/usr/bin/env bash
# 每天 03:20 由 house-backup.timer 跑：sqlite3 .backup 热备 + gzip + 保留 14 份。
# 手动：sudo /opt/house/current/infra/backup.sh
set -euo pipefail

DB="${HOUSE_DB:-/var/lib/house/house.db}"
OUT_DIR="${HOUSE_BACKUP_DIR:-/var/backups/house}"
KEEP="${HOUSE_BACKUP_KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$OUT_DIR/house-$STAMP.db"

[ -f "$DB" ] || { echo "!! 找不到库：$DB"; exit 1; }
mkdir -p "$OUT_DIR"

# 同一时刻只允许一份备份在跑（timer 撞上手动执行时不叠罗汉）
exec 9>"$OUT_DIR/.backup.lock"
flock -n 9 || { echo "已有一份备份在跑，跳过"; exit 0; }

# .backup 走 SQLite 自己的备份 API，WAL 下也能拿到一致快照；路径没空格，不加引号更省事
sqlite3 "$DB" ".backup $TMP"
sqlite3 "$TMP" "pragma integrity_check;" | grep -qx ok || { echo "!! 备份完整性检查失败：$TMP"; rm -f "$TMP"; exit 1; }
gzip -9 "$TMP"
chmod 600 "$TMP.gz"

ls -1t "$OUT_DIR"/house-*.db.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "backup ok: $TMP.gz ($(du -h "$TMP.gz" | cut -f1))"
