#!/usr/bin/env bash
# 冒烟：API 起得来、配对能发、同步能写能读、任务能排队能领、守卫生效。
# 用法：BASE=http://127.0.0.1:8787 ITOKEN=dev-internal-token bash scripts/smoke.sh
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:8787}"
ITOKEN="${ITOKEN:-dev-internal-token}"

jq_get() { node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).$1"; }
say() { printf '\n--- %s\n' "$1"; }

say health
curl -fsS "$BASE/health"; echo

say pair
CODE=$(curl -fsS -X POST "$BASE/internal/pair/code" -H "x-internal-token: $ITOKEN" \
  -H 'content-type: application/json' -d '{"deviceName":"smoke"}' | jq_get code)
echo "code=$CODE"
TOKEN=$(curl -fsS -X POST "$BASE/auth/pair" -H 'content-type: application/json' \
  -d "{\"code\":\"$CODE\",\"deviceName\":\"smoke\",\"platform\":\"web\"}" | jq_get token)
echo "token=${TOKEN:0:8}…"
AUTH="authorization: Bearer $TOKEN"
NOW=$(node -pe 'new Date().toISOString()')

say push community（新行）
curl -fsS -X POST "$BASE/sync/push" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"deviceId\":\"smoke\",\"items\":[{\"table\":\"community\",\"uid\":\"0192f0aa-0000-7000-8000-0000000000c1\",\"op\":\"upsert\",\"fields\":{\"name\":\"海怡东方\",\"district\":\"南山\",\"lng\":113.9,\"lat\":22.5},\"baseRev\":0,\"clientTs\":\"$NOW\"}]}"
echo

say push check_state ×2（幂等）
for n in 0 1; do
  curl -fsS -X POST "$BASE/sync/push" -H "$AUTH" -H 'content-type: application/json' \
    -d "{\"deviceId\":\"smoke\",\"items\":[{\"table\":\"check_state\",\"uid\":\"0192f0aa-0000-7000-8000-0000000000c2\",\"op\":\"upsert\",\"fields\":{\"kind\":\"redline\",\"item_key\":\"r01\",\"checked\":$n},\"baseRev\":0,\"clientTs\":\"$NOW\"}]}"
  echo
done

say pull since=0
curl -fsS "$BASE/sync/pull?since=0" -H "$AUTH" | head -c 300; echo

say push delete → tombstone
curl -fsS -X POST "$BASE/sync/push" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"deviceId\":\"smoke\",\"items\":[{\"table\":\"check_state\",\"uid\":\"0192f0aa-0000-7000-8000-0000000000c2\",\"op\":\"delete\",\"fields\":{},\"baseRev\":0,\"clientTs\":\"$NOW\"}]}"
echo
curl -fsS "$BASE/sync/pull?since=2" -H "$AUTH" | tail -c 200; echo

say communities
curl -fsS -G "$BASE/communities" --data-urlencode 'q=海怡' -H "$AUTH" | head -c 300; echo

say job 排队 → claim → finish
JOB=$(curl -fsS -X POST "$BASE/community/fill" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"communityUid":"0192f0aa-0000-7000-8000-0000000000c1"}' | jq_get jobId)
echo "job=$JOB"
curl -fsS -X POST "$BASE/internal/jobs/claim" -H "x-internal-token: $ITOKEN" | head -c 200; echo
curl -fsS -X POST "$BASE/internal/jobs/$JOB/finish" -H "x-internal-token: $ITOKEN" \
  -H 'content-type: application/json' -d '{"ok":true,"result":{"stub":true}}'; echo
curl -fsS "$BASE/jobs/$JOB" -H "$AUTH"; echo

say 守卫（期望 401 / 403 / 403 / 404）
curl -s -o /dev/null -w 'unauth:%{http_code} ' "$BASE/communities"
curl -s -o /dev/null -w 'internal无令牌:%{http_code} ' -X POST "$BASE/internal/jobs/claim"
curl -s -o /dev/null -w 'internal错令牌:%{http_code} ' -X POST "$BASE/internal/jobs/claim" -H 'x-internal-token: wrong'
curl -s -o /dev/null -w '缺小区:%{http_code}\n' "$BASE/communities/nope" -H "$AUTH"

say rules
curl -fsS "$BASE/rules" -H "$AUTH"; echo

echo 'SMOKE OK'
