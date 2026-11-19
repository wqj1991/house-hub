#!/usr/bin/env bash
# 出配对码：手机「我的 → 数据服务器」里填它 + 服务器地址，10 分钟内有效，一台设备一个。
#
#   本机调试：   bash scripts/pair-code.sh                # 默认 127.0.0.1:18878 / dev-internal-token
#   换端口令牌： bash scripts/pair-code.sh 8787 mytoken
#   服务器上：   ssh 进服务器后在服务器本机执行同一条命令（/internal/pair/code 只给本机用）
#                HOUSE_INTERNAL_TOKEN 在 systemd 里：sudo systemctl cat house-api | grep HOUSE_INTERNAL_TOKEN
set -uo pipefail

PORT="${1:-${API_PORT:-18878}}"
TOKEN="${2:-${HOUSE_INTERNAL_TOKEN:-dev-internal-token}}"
BASE="${PAIR_BASE:-http://127.0.0.1:$PORT}"

resp=$(curl -s -m 5 -X POST -H "x-internal-token: $TOKEN" "$BASE/internal/pair/code" 2>/dev/null)
code=$(printf '%s' "$resp" | sed -n 's/.*"code":"\([0-9]*\)".*/\1/p')
if [ -z "$code" ]; then
  echo "出码失败：$(printf '%s' "$resp" | head -c 200)" >&2
  echo "检查：API 是否在跑（curl $BASE/health）、内部令牌是否对（x-internal-token）" >&2
  exit 1
fi

echo "配对码：$code"
echo "服务器地址：$BASE"
echo "（10 分钟内有效；手机填这两项后点「连接服务器」）"
