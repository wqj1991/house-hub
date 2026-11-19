#!/usr/bin/env node
/**
 * 一次性修补 packages/core/src/content/newhouse.ts 的快照。
 *
 * 为什么需要它：2026-11-18 那次全量抓取时，详情页请求已经被房天下反爬墙
 * （拿到的是滑块验证页），而且当时的价格解析把「420 万元/套起」的总价口径
 * 写进了单价字段，板块正则也没命中。现在站点还在封（302 → check.3g.fang.com），
 * 重抓拿不到数据，所以先把快照里能离线修的三件事修掉：
 *
 *   1. 板块：按 scripts/lib/bizcircles.mjs 的词典从「名称 + 地址」最长匹配；
 *   2. 价格：priceText 是「万元/套」口径的，把数字挪到总价门槛、单价置空；
 *   3. 状态：剔除「地块」/「出租」这类非住宅条目。
 *
 * 开盘 / 交房 / 开发商 / 产权 只能靠详情页，封禁解除后重跑
 * node scripts/crawl-newhouse.mjs --slow 会整体覆盖这份快照。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { matchBizcircle, SKIP_STATUS } from "./lib/bizcircles.mjs";

const FILE = resolve("packages/core/src/content/newhouse.ts");
const src = readFileSync(FILE, "utf8");
// 从证据类型标注后面的数组字面量开始切：第一个 "[" 出现在 NewProjectFact[] 里，不能直接用它
const marker = "NewProjectFact[] = [";
const start = src.indexOf(marker) + marker.length - 1;
const end = src.lastIndexOf("];") + 1;
if (start < 0 || end <= start) throw new Error("快照文件格式不认识：" + FILE);
const rows = JSON.parse(src.slice(start, end));
// 快照整体重写一次，抓取时间跟着走：服务端按 fetchedAt 判断是否要更新那条记录，
// 不刷新时间戳的话修好的字段永远进不了库。
const repairedAt = new Date().toISOString();

let biz = 0;
let price = 0;
const dropped = [];

const repaired = rows
  .filter((row) => {
    if (!SKIP_STATUS.has(row.saleStatus)) return true;
    dropped.push(row.name + "（" + row.saleStatus + "）");
    return false;
  })
  .map((row) => {
    const next = { ...row, fetchedAt: repairedAt };
    if (!next.bizcircle) {
      const hit = matchBizcircle(next.district, next.name, next.address);
      if (hit) {
        next.bizcircle = hit;
        biz += 1;
      }
    }
    // 「420 万元/套起(总价)」是总价口径，不是单价
    if (/万元\/套/.test(next.priceText ?? "")) {
      const num = Number((String(next.priceText).match(/([\d.]+)\s*万元\/套/) ?? [])[1]) || 0;
      if (num > 0 && !next.totalPriceFrom) next.totalPriceFrom = Math.round(num);
      if (next.priceAvg) {
        next.priceAvg = null;
        price += 1;
      }
    } else if (next.priceAvg && next.priceAvg < 3000) {
      next.priceAvg = null;
      price += 1;
    }
    if (next.priceAvg && (next.priceAvg < 3000 || next.priceAvg > 300000)) {
      next.priceAvg = null;
      price += 1;
    }
    return next;
  });

const header =
  "/**\n" +
  " * 新房事实快照：房天下 newhouse.fang.com 抓取（大兴 / 通州）。\n" +
  " *\n" +
  " * 抓数产物，不要手改：重抓走 scripts/crawl-newhouse.mjs。\n" +
  " * 生成时间 " +
  new Date().toISOString() +
  "，共 " +
  repaired.length +
  " 个楼盘。\n" +
  " */\n\n" +
  'import type { NewProjectFact } from "../domain/newProject";\n\n' +
  "export const NEW_PROJECTS: NewProjectFact[] = " +
  JSON.stringify(repaired, null, 2) +
  ";\n";

writeFileSync(FILE, header);
console.log("修补完成：共 " + repaired.length + " 条");
console.log("  补板块 " + biz + " / 修价格口径 " + price + " / 剔除非住宅 " + dropped.length);
dropped.forEach((line) => console.log("  - " + line));
const withBiz = repaired.filter((r) => r.bizcircle).length;
console.log(
  "  板块覆盖 " + withBiz + "/" + repaired.length +
    "，无单价 " + repaired.filter((r) => !r.priceAvg).length +
    "，有开盘时间 " + repaired.filter((r) => r.openDate).length,
);
