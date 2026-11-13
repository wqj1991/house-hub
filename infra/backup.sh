#!/usr/bin/env bash
# 每天 03:20 由 house-backup.timer 跑：sqlite3 .backup 热备 + gzip + 保留 14 份
set -euo pipefail

DB="${HOUSE_DB:-/var/lib/house/house.db}"
OUT_DIR="${HOUSE_BACKUP_DIR:-/var/backups/house}"
KEEP="${HOUSE_BACKUP_KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$OUT_DIR/house-$STAMP.db"

mkdir -p "$OUT_DIR"

# .backup 走 SQLite 自己的备份 API，WAL 下也能拿到一致快照
sqlite3 "$DB" ".backup '$TMP'"
sqlite3 "$TMP" "pragma integrity_check;" | grep -qx ok
gzip -9 "$TMP"

ls -1t "$OUT_DIR"/house-*.db.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "backup ok: $TMP.gz"
