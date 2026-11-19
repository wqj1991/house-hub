#!/usr/bin/env bash
# 本地 Web 调试：一条命令拉起 API + Vite（HMR），浏览器里直接调 Web 端
#   bash scripts/web-dev.sh              # API 18878 + 前端 1420，自动开浏览器
#   bash scripts/web-dev.sh --no-open    # 不开浏览器
#   bash scripts/web-dev.sh --api-only   # 只起 API（前端自己在 IDE 里起）
#   bash scripts/web-dev.sh --web-only   # 只起 Vite（API 已在跑或指向远端）
#   API_PORT=18879 bash scripts/web-dev.sh
#
# 为什么默认 18878 而不是 8787：8787 在本机落在 netsh 保留段（8699-8798），监听直接 EACCES
#   （见 scripts/android-dev.sh:60）。前端 apps/web/src/lib/serverClient.ts:24 的 DEV_PORTS
#   也是 [18878, 8787] 按序探活，所以这里起的端口它能自己发现。
# 日志：D:/dsh/cache/tmp/web-dev.log（脚本）与 api-dev.log（API）；
# 库：D:/dsh/cache/house/house.db。都不进仓库，也不落 C 盘。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-18878}"
API_DB="${HOUSE_DB_PATH:-D:/dsh/cache/house/house.db}"
API_TOKEN="${HOUSE_INTERNAL_TOKEN:-dev-internal-token}"
WEB_PORT="${WEB_PORT:-1420}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
TMP="D:/dsh/cache/tmp"
LOG="$TMP/web-dev.log"
API_LOG="${API_DEV_LOG:-$TMP/api-dev.log}"
OPEN_BROWSER=1
DO_API=1
DO_WEB=1

for arg in "$@"; do
  case "$arg" in
    --no-open) OPEN_BROWSER=0 ;;
    --open) OPEN_BROWSER=1 ;;
    --api-only) DO_WEB=0 ;;
    --web-only) DO_API=0 ;;
    -h|--help)
      sed -n '2,11p' "${BASH_SOURCE[0]}" | sed 's/^# *//'
      exit 0 ;;
    *) printf '未知参数：%s（试 --help）\n' "$arg" >&2; exit 2 ;;
  esac
done

mkdir -p "$TMP" D:/dsh/cache/house 2>/dev/null; : > "$LOG"
say() { printf '[web] %s\n' "$*" | tee -a "$LOG"; }

API_HEALTH="http://127.0.0.1:$API_PORT/health"
WEB_URL="http://127.0.0.1:$WEB_PORT/"

# MSYS 的 kill 对原生 exe（node.exe）常留残：先 kill，200ms 还在就 taskkill //T 连子进程一起收
kill_child() {
  local p="$1"
  [ -z "$p" ] && return 0
  kill "$p" 2>/dev/null
  sleep 0.2
  kill -0 "$p" 2>/dev/null || return 0
  taskkill //F //T //PID "$p" >/dev/null 2>&1 || kill -9 "$p" 2>/dev/null
}

# Ctrl-C 必须真的停住：trap 里只 kill 不 exit 时主循环会接着转，表现成「按了没反应」
STOPPED=
cleanup() {
  local rc=$?
  [ -n "$STOPPED" ] && exit "$rc"
  STOPPED=1
  trap - EXIT INT TERM
  if [ -n "${VITE_PID:-}" ]; then say "停止前端（pid $VITE_PID）"; kill_child "$VITE_PID"; fi
  if [ -n "${API_PID:-}" ]; then say "停止本次拉起的 API（pid $API_PID）"; kill_child "$API_PID"; fi
  say "已停止"
  exit "$rc"
}
trap cleanup EXIT INT TERM

up() { curl -s -m 2 -o /dev/null "$1"; }

API_PID=
if [ "$DO_API" = 1 ]; then
  if up "$API_HEALTH"; then
    say "复用已在跑的 API（127.0.0.1:$API_PORT）"
  else
    say "启动 API（127.0.0.1:$API_PORT，tsx watch，库 $API_DB，日志 $API_LOG）"
    : > "$API_LOG"
    # dev = tsx watch：改 services/api 下任何 .ts 自动重启
    ( cd "$ROOT" && PORT="$API_PORT" HOST=127.0.0.1 HOUSE_DB_PATH="$API_DB" \
        HOUSE_INTERNAL_TOKEN="$API_TOKEN" pnpm --filter @house/api dev >>"$API_LOG" 2>&1 ) &
    API_PID=$!
    for _ in $(seq 1 60); do up "$API_HEALTH" && break; sleep 1; done
    if up "$API_HEALTH"; then
      say "API 就绪：$API_HEALTH"
    else
      say "API 没起来，尾部日志（完整：$API_LOG）："
      tail -15 "$API_LOG" | tee -a "$LOG"
      exit 1
    fi
  fi
fi

VITE_PID=
if [ "$DO_WEB" = 1 ]; then
  if up "$WEB_URL"; then
    say "复用已在跑的前端（$WEB_URL）"
    # 已有 vite 在跑，但可能没把 /house-api 代理到本脚本的 API（真机/局域网访问才用得上这条代理）
    if up "http://127.0.0.1:$WEB_PORT/house-api/health"; then
      say "已跑的 vite 代理正常"
    else
      say "提示：已跑的 vite 代理不到 127.0.0.1:$API_PORT，停掉它再重跑本脚本（脚本会传 HOUSE_API_URL）"
    fi
  else
    say "启动前端 dev server（$WEB_URL，HMR，代理 /house-api → $API_PORT）"
    # HOUSE_API_URL 给 apps/web/vite.config.ts:29 的 /house-api 代理目标用；loopback 打开时前端会直连 18878
    ( cd "$ROOT/apps/web" && HOUSE_API_URL="http://127.0.0.1:$API_PORT" \
        pnpm exec vite --host "$WEB_HOST" --port "$WEB_PORT" --strictPort >>"$LOG" 2>&1 ) &
    VITE_PID=$!
    for _ in $(seq 1 60); do up "$WEB_URL" && break; sleep 1; done
    if up "$WEB_URL"; then
      say "前端就绪：$WEB_URL"
    else
      say "前端没起来，尾部日志："
      tail -20 "$LOG"
      exit 1
    fi
  fi
fi

if [ "$DO_API" = 1 ] && up "$API_HEALTH"; then
  CODE=$(curl -s -m 3 -X POST "http://127.0.0.1:$API_PORT/internal/pair/code" -H "x-internal-token: $API_TOKEN" \
           -H 'content-type: application/json' -d '{"deviceName":"web-dev"}' 2>/dev/null \
         | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).code)}catch{}})')
  [ -n "$CODE" ] && say "配对码（Web 端首次连服务器用，10 分钟内有效）：$CODE"
fi

say "地址：$WEB_URL   API 健康：$API_HEALTH"
say "冒烟：BASE=http://127.0.0.1:$API_PORT bash scripts/smoke.sh"

if [ "$OPEN_BROWSER" = 1 ] && [ "$DO_WEB" = 1 ]; then
  cmd.exe //c start "" "$WEB_URL" >/dev/null 2>&1
fi

say "监听改动中：前端 HMR 即时生效，API 由 tsx watch 自动重启（Ctrl-C 退出）"
# 子进程意外退出时把日志打出来，别让人对着一个死掉的端口猜
while :; do
  sleep 2
  if [ -n "$VITE_PID" ] && ! kill -0 "$VITE_PID" 2>/dev/null; then
    say "前端进程退出，日志尾部："; tail -20 "$LOG"; exit 1
  fi
  if [ -n "$API_PID" ] && ! kill -0 "$API_PID" 2>/dev/null; then
    say "API 进程退出，日志尾部："; tail -20 "$API_LOG"; exit 1
  fi
done
