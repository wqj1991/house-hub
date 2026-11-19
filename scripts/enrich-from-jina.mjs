#!/usr/bin/env node
/**
 * 用房天下详情页的 JSON-LD（经 r.jina.ai 取回的原始 HTML）补全快照字段。
 *
 * 房天下把楼盘基础信息放在 <script type="application/ld+json"> 里的
 * PropertyValue 列表：销售状态 / 开盘时间 / 交房时间 / 物业类别 / 项目特色 /
 * 装修状况 / 建筑类别 / 产权年限 / 环线位置 / 开发商 / 售楼地址 / 所属区域。
 *
 * 只补空字段，不覆盖已有值（列表页数据优先），每条改动都刷新 fetchedAt 以便服务端幂等入库。
 *
 * 用法：node scripts/enrich-from-jina.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT = resolve(ROOT, "packages/core/src/content/newhouse.ts");
const CACHE = "D:/dsh/cache/house/jina";
const dry = process.argv.includes("--dry");

/** 房天下字段名 → 快照字段名。 */
const MAP = {
  销售状态: "saleStatus",
  开盘时间: "openDate",
  交房时间: "deliveryDate",
  物业类别: "propertyType",
  装修状况: "decoration",
  建筑类别: "buildingType",
  产权年限: "ownership",
  环线位置: "ring",
  开发商: "developer",
  售楼地址: "salesAddress",
};

function readSnapshot() {
  const src = readFileSync(SNAPSHOT, "utf8");
  const marker = "NewProjectFact[] = [";
  const start = src.indexOf(marker) + marker.length - 1;
  const end = src.lastIndexOf("];") + 1;
  return JSON.parse(src.slice(start, end));
}

/** 从一份详情页 HTML 里抽出 PropertyValue 键值对。 */
function parseFacts(html) {
  const out = {};
  const re = /\{"@type":"PropertyValue","name":"([^"]+)","value":"([^"]*)"\}/g;
  let m;
  while ((m = re.exec(html))) out[m[1]] = m[2];
  // 项目特色是逗号串，单独留一份给 tags
  if (out["项目特色"]) out.tags = out["项目特色"].split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return out;
}

/** 「和悦璞云普通住宅产权为70年」→「70年」。 */
function normOwnership(v) {
  const m = String(v || "").match(/(\d+)\s*年/);
  return m ? m[1] + "年" : "";
}

const rows = readSnapshot();
const files = new Set(existsSync(CACHE) ? readdirSync(CACHE).filter((f) => f.endsWith(".html")) : []);
console.log("快照 " + rows.length + " 条，详情缓存 " + files.size + " 份");

let filled = 0;
let changed = 0;
const stat = { openDate: 0, deliveryDate: 0, developer: 0, ownership: 0, decoration: 0, buildingType: 0, salesAddress: 0 };
const misses = [];

for (const row of rows) {
  const file = row.uid + ".html";
  if (!files.has(file)) {
    misses.push(row.name);
    continue;
  }
  const html = readFileSync(CACHE + "/" + file, "utf8");
  if (html.length < 20000 || html.includes("Just a moment")) {
    misses.push(row.name + "(页面异常)");
    continue;
  }
  const facts = parseFacts(html);
  if (!Object.keys(facts).length) {
    misses.push(row.name + "(无结构化字段)");
    continue;
  }
  const patch = {};
  for (const [cn, key] of Object.entries(MAP)) {
    if (!facts[cn]) continue;
    if (row[key]) continue; // 已有值不覆盖
    let v = facts[cn];
    if (key === "ownership") v = normOwnership(v);
    if (!v || v === "暂无资料" || v === "-") continue;
    patch[key] = v;
  }
  if (facts.tags && Array.isArray(row.tags) && facts.tags.length > (row.tags?.length ?? 0)) {
    patch.tags = facts.tags;
  }
  const keys = Object.keys(patch);
  if (!keys.length) continue;
  Object.assign(row, patch, { fetchedAt: new Date().toISOString() });
  for (const k of keys) if (k in stat) stat[k]++;
  changed++;
  filled++;
  if (changed <= 10) console.log("  " + row.name + " ← " + JSON.stringify(patch));
}

const header =
  "// 新房快照：scripts/crawl-newhouse.mjs（房天下列表）+ scripts/enrich-from-jina.mjs（详情字段）\n" +
  "// 更新时间 " + new Date().toISOString() + "，共 " + rows.length + " 个楼盘\n" +
  "// 大兴 / 通州在售与待售新盘；地块与出租类条目已剔除\n";
const body = JSON.stringify(rows, null, 2);
const text =
  header +
  'import type { NewProjectFact } from "../domain/newProject";\n\n' +
  "export const NEW_PROJECTS: NewProjectFact[] = " + body + ";\n";

if (!dry) writeFileSync(SNAPSHOT, text, "utf8");

const count = (k) => rows.filter((r) => r[k]).length;
console.log("更新 " + changed + " 条" + (dry ? "（dry，未写文件）" : "") + "；新增 " + JSON.stringify(stat));
console.log(
  "覆盖率：开盘 " + count("openDate") + "、交房 " + count("deliveryDate") + "、开发商 " + count("developer") +
    "、产权 " + count("ownership") + "、装修 " + count("decoration") + "、建筑类别 " + count("buildingType") +
    "、售楼地址 " + count("salesAddress") + " / " + rows.length,
);
if (misses.length) console.log("未覆盖 " + misses.length + " 条：" + misses.slice(0, 6).join("、"));
