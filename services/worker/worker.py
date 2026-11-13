#!/usr/bin/env python3
"""worker：领活、干活、交活。

纪律（ARCHITECTURE §2）：不直连 house.db，不 import 服务端代码，
只走 http://127.0.0.1:8787/internal/*，带 x-internal-token。
锁在 Python 3.6 语法上（线上系统的 python3 版本老），只用标准库。
"""

import argparse
import json
import os
import random
import sys
import time
import traceback
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API = os.environ.get("HOUSE_API", "http://127.0.0.1:8787").rstrip("/")
TOKEN = os.environ.get("HOUSE_INTERNAL_TOKEN", "dev-internal-token")
DEFAULT_INTERVAL = int(os.environ.get("HOUSE_WORKER_INTERVAL", "30"))


def log(msg):
    sys.stderr.write("[worker] " + msg + "\n")
    sys.stderr.flush()


def call(path, payload=None, timeout=30):
    """返回 (status, body)；204 的 body 是 None。"""
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = Request(API + path, data=data, method="POST" if data is not None else "GET")
    req.add_header("x-internal-token", TOKEN)
    req.add_header("accept", "application/json")
    if data is not None:
        req.add_header("content-type", "application/json")
    try:
        with urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8")
            return res.status, (json.loads(raw) if raw else None)
    except HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        return err.code, (json.loads(raw) if raw else None)


def claim():
    status, body = call("/internal/jobs/claim")
    if status == 204:
        return None
    if status != 200:
        raise RuntimeError("claim 失败：" + str(status) + " " + json.dumps(body, ensure_ascii=False))
    return body


def finish(job_id, ok, result=None, error=None):
    payload = {"ok": ok}
    if result is not None:
        payload["result"] = result
    if error:
        payload["error"] = error[:2000]
    status, body = call("/internal/jobs/" + job_id + "/finish", payload)
    if status != 200:
        log("finish 失败：" + str(status) + " " + json.dumps(body, ensure_ascii=False))


def handle_community_fill(payload):
    """P3 才接真实抓数；现在只把活接下来，记清楚要抓谁。"""
    key = payload.get("communityUid") or payload.get("name")
    if not key:
        raise ValueError("community_fill 缺少 communityUid/name")
    return {
        "stub": True,
        "target": key,
        "district": payload.get("district"),
        "note": "抓数未接入（高德/成交明细 P3 落地）",
    }


def handle_route_compute(payload):
    """通勤矩阵同理：先接单，P3 调高德路径规划。"""
    person = payload.get("personUid")
    if not person:
        raise ValueError("route_compute 缺少 personUid")
    targets = payload.get("communityUids") or []
    return {
        "stub": True,
        "personUid": person,
        "communities": len(targets),
        "note": "路径规划未接入（P3 接高德）",
    }


HANDLERS = {
    "community_fill": handle_community_fill,
    "route_compute": handle_route_compute,
}


def run_one():
    job = claim()
    if not job:
        return False
    job_id = job.get("id")
    kind = job.get("kind")
    payload = job.get("payload") or {}
    log("领到 " + str(job_id) + " kind=" + str(kind))
    handler = HANDLERS.get(kind)
    if handler is None:
        finish(job_id, False, error="未知任务类型：" + str(kind))
        return True
    try:
        result = handler(payload)
        finish(job_id, True, result=result)
        log("完成 " + str(job_id))
    except Exception as exc:
        # 单个任务失败只让那条 failed，进程继续活着
        tb = traceback.format_exc(limit=3)
        log("失败 " + str(job_id) + "：" + str(exc))
        finish(job_id, False, error=str(exc) + "\n" + tb)
    return True


def main(argv=None):
    parser = argparse.ArgumentParser(description="house worker")
    parser.add_argument("--once", action="store_true", help="只跑一轮（cron/timer 用）")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL, help="空转时的间隔秒数")
    parser.add_argument("--max", type=int, default=0, help="最多处理多少个任务，0 = 不限")
    args = parser.parse_args(argv)

    served = 0
    while True:
        try:
            worked = run_one()
        except (URLError, OSError) as exc:
            log("API 不可达：" + str(exc))
            if args.once:
                return 1
            time.sleep(args.interval)
            continue
        if worked:
            served += 1
            if args.max and served >= args.max:
                return 0
            continue
        if args.once:
            return 0
        time.sleep(args.interval + random.random())


if __name__ == "__main__":
    sys.exit(main())
