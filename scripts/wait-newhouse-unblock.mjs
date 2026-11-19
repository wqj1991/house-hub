#!/usr/bin/env node
/**
 * 等房天下解封后自动补详情：每 3 分钟探一次列表页，
 * 一旦不再 302 到 check.3g.fang.com、也不是滑块页，就跑 `crawl-newhouse --detail-only --slow`。
 * 用 --detail-only 是为了不重复抓列表页，也不覆盖已经修好的板块/价格数据。
 */
import { spawnSync } from "node:child_process";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const PROBE = "https://newhouse.fang.com/house/s/daxing/";
const MAX_ROUNDS = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable() {
  try {
    const res = await fetch(PROBE, {
      headers: { "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const html = await res.text();
    const blocked = html.includes("checkyzm") || html.includes("请完成下列验证") || html.length < 3000;
    console.log(new Date().toISOString(), "probe", res.status, html.length, blocked ? "blocked" : "open");
    return res.ok && !blocked;
  } catch (err) {
    console.log(new Date().toISOString(), "probe failed", String(err).slice(0, 120));
    return false;
  }
}

for (let round = 1; round <= MAX_ROUNDS; round++) {
  if (await reachable()) {
    console.log("站点放行，开始补详情…");
    const run = spawnSync("node", ["scripts/crawl-newhouse.mjs", "--detail-only", "--slow"], { stdio: "inherit" });
    console.log("补详情结束，exit", run.status);
    process.exit(run.status ?? 0);
  }
  await sleep(3 * 60 * 1000);
}
console.log("等了 " + MAX_ROUNDS + " 轮仍被墙，放弃本次自动重试");
