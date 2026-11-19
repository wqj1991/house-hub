#!/usr/bin/env bash
# 本机直发：这台机器本身就是生产服务器，所以不走 SSH、也不走 1Panel HTTP API。
# 构建 → 落 release 目录 → 装依赖 → 原子切 current → 同步静态 → 重启 → 自检 → 失败回滚 → 清旧版。
#
# 用法（root）：
#   bash infra/deploy-local.sh                 # 全流程
#   bash infra/deploy-local.sh --skip-build    # 用现有 apps/web/dist（改后端时快）
#   bash infra/deploy-local.sh --no-web        # 不动 nginx 静态目录（只发 API）
#   bash infra/deploy-local.sh --restart       # 只重启服务再自检
#   bash infra/deploy-local.sh --keep 2        # 保留份数（默认 4）
set -euo pipefail

SRC="${HOUSE_SRC:-/root/house-hub}"                       # 源码工作区（git 树）
BASE="${HOUSE_BASE:-/opt/house-hub}"                      # 线上：current/releases/incoming/logs
WEB_ROOT="${HOUSE_WEB_ROOT:-/opt/1panel/apps/openresty/openresty/www/house}"
SERVICE="${HOUSE_API_SERVICE:-house-hub-api}"
ENVFILE="$BASE/api.env"
KEEP="${HOUSE_KEEP:-4}"

SKIP_BUILD=0; NO_WEB=0; ONLY_RESTART=0
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    --no-web) NO_WEB=1 ;;
    --restart) ONLY_RESTART=1 ;;
    --keep) KEEP="${2:?--keep 需要数字}"; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "未知参数：$1"; exit 2 ;;
  esac
  shift
done

log() { printf '\n== %s\n' "$*"; }
die() { printf '\n!! %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "要用 root 跑（要写 $BASE 和 systemctl restart）"
PNPM="$(command -v pnpm || true)"
[ -n "$PNPM" ] || die "找不到 pnpm（corepack enable 或设 PATH）"
[ -f "$ENVFILE" ] || die "缺 $ENVFILE"
PORT="$(grep -E '^PORT=' "$ENVFILE" | head -1 | cut -d= -f2)"
API="http://127.0.0.1:${PORT:-8787}"

health() {
  HOUSE_API_URL="$API" HOUSE_DB="${HOUSE_DB:-/var/lib/house/house.db}" \
    bash "${1:-$BASE/current}/infra/healthcheck.sh"
}

if [ "$ONLY_RESTART" = 1 ]; then
  log "只重启 $SERVICE"
  systemctl restart "$SERVICE"
  sleep 1
  health && { echo "OK：$(readlink -f "$BASE/current")"; exit 0; }
  die "重启后自检不过（看 journalctl -u $SERVICE -n 50）"
fi

# ---------- 1. 构建（服务器不装构建链，产物必须带 dist）----------
if [ "$SKIP_BUILD" = 1 ]; then
  log "跳过构建（用现有 apps/web/dist）"
else
  log "构建（base=/house/）"
  ( cd "$SRC" && HOUSE_WEB_BASE=/house/ "$PNPM" install --frozen-lockfile --reporter=silent \
    && HOUSE_WEB_BASE=/house/ "$PNPM" build )
fi

DIST="$SRC/apps/web/dist"
[ -f "$DIST/index.html" ] || die "缺 $DIST/index.html，先去掉 --skip-build"
grep -q '/house/assets/' "$DIST/index.html" || die "dist 里的资源不是 /house/assets/*，base 配错了"

# ---------- 2. 落 release 目录 ----------
STAMP="$(TZ=Asia/Shanghai date +%Y%m%d-%H%M%S)"
DEST="$BASE/releases/$STAMP"
while [ -e "$DEST" ]; do STAMP="$STAMP-1"; DEST="$BASE/releases/$STAMP"; done
PREV="$(readlink -f "$BASE/current" 2>/dev/null || true)"

log "复制源码 → $DEST"
mkdir -p "$DEST" "$BASE/releases"
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude .xdg --exclude .npm --exclude .pnpm-store \
  --exclude .vite --exclude coverage --exclude target \
  "$SRC"/ "$DEST"/

log "安装依赖（tsx 是 start 的启动器，devDependencies 不能省）"
( cd "$DEST" && "$PNPM" install --frozen-lockfile --reporter=silent )

# ---------- 3. 原子切链 ----------
log "切换 current（上一版：${PREV:-无}）"
ln -sfn "$DEST" "$BASE/current.new"
mv -Tf "$BASE/current.new" "$BASE/current"

# ---------- 4. 静态文件 ----------
if [ "$NO_WEB" = 0 ]; then
  log "同步静态文件 → $WEB_ROOT"
  mkdir -p "$WEB_ROOT"
  rsync -a --delete "$DEST/apps/web/dist/" "$WEB_ROOT/"
else
  log "跳过静态文件（--no-web）"
fi

# ---------- 5. 重启 + 自检 ----------
log "重启 $SERVICE"
# restart 失败也算发布失败（不要 set -e 直接退：current 已经切过去了，必须回滚）
if systemctl restart "$SERVICE" && sleep 1 && health "$DEST"; then
  log "OK：$STAMP 已上线（current → $DEST）"
  if command -v git >/dev/null && [ -d "$SRC/.git" ]; then
    REV="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo '?')"
    DIRTY="$(git -C "$SRC" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
    echo "源码：$REV（未提交改动 $DIRTY 处）"
    printf '{"stamp":"%s","git":"%s","dirty":%s,"at":"%s"}\n' \
      "$STAMP" "$REV" "$DIRTY" "$(date -Is)" > "$BASE/.last-deploy.json"
  fi
else
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    log "!! 自检失败 → 回滚到 $PREV"
    ln -sfn "$PREV" "$BASE/current.new"
    mv -Tf "$BASE/current.new" "$BASE/current"
    [ "$NO_WEB" = 0 ] && rsync -a --delete "$PREV/apps/web/dist/" "$WEB_ROOT/"
    systemctl restart "$SERVICE" || true
    sleep 1
    health "$PREV" && { echo "已回滚，线上是 $(basename "$PREV")，本次改动未生效"; exit 1; }
    die "回滚后仍不健康，人工介入：journalctl -u $SERVICE -n 80 --no-pager"
  fi
  die "自检失败且没有上一版可回滚，人工介入"
fi

# ---------- 6. 清旧版 ----------
CUR="$(readlink -f "$BASE/current")"
log "清理旧版本（保留 $KEEP 份）"
ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  [ "$(readlink -f "$old")" = "$CUR" ] && continue
  rm -rf "$old"
done
ls -1dt "$BASE"/releases/*/ 2>/dev/null | sed -n "1,${KEEP}p"
