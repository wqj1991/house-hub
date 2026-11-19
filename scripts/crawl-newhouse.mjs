#!/usr/bin/env node
/**
 * 房天下新房抓取：大兴 / 通州。
 *
 * 为什么抓房天下：链家/贝壳分区页要登录、安居客弹反爬验证码，房天下
 * newhouse.fang.com 的 /house/s/<district>/ 列表页匿名可读，详情页还带
 * JSON-LD 的 PropertyValue（开盘时间 / 交房时间 / 开发商 / 产权年限…）。
 *
 * 反爬现状（2026-11 实测）：连打几十个详情页后会发 837 字节的滑块验证页
 * （js.soufunimg.com/fangue/libs/check/checkyzm.min.js）。所以这里：低并发、
 * 每请求随机间隔、UA 轮换、带 cookie，识别到验证页就退避重试，别硬撞。
 *
 * 产物：packages/core/src/content/newhouse.ts（编译进 core 的事实快照），
 * 服务端启动时按 uid 幂等灌进 new_project 表（同 shuttleSeed 的做法）。
 *
 *   node scripts/crawl-newhouse.mjs             # 抓两个区并写快照
 *   node scripts/crawl-newhouse.mjs --pages 2   # 每区只抓 2 页（调试）
 *   node scripts/crawl-newhouse.mjs --no-detail # 只抓列表，不补详情页
 *   node scripts/crawl-newhouse.mjs --slow      # 详情间隔 3s，被限流时用
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

const DISTRICTS = [
  { slug: "daxing", name: "大兴" },
  { slug: "tongzhou", name: "通州" },
];

/**
 * 板块词典：房天下列表页的区域下拉解析不稳（板块名和排序参数混在同一个 href 结构里），
 * 这里改成"按名字最长匹配地址"，离线、稳定、可人工维护。
 */
const BIZCIRCLES = {
  大兴: [
    "亦庄经济技术开发区",
    "国家新媒体产业基地",
    "生物医药基地",
    "亦庄",
    "旧宫",
    "西红门",
    "黄村",
    "天宫院",
    "瀛海",
    "义和庄",
    "高米店",
    "枣园",
    "清源",
    "兴华大街",
    "采育",
    "庞各庄",
    "魏善庄",
    "长子营",
    "青云店",
    "礼贤",
    "榆垡",
    "北臧村",
    "观音寺",
    "林校路",
    "团河",
    "南中轴",
    "新宫",
    "安定",
  ],
  通州: [
    "城市副中心",
    "通州北苑",
    "北苑",
    "北关",
    "果园",
    "九棵树",
    "梨园",
    "临河里",
    "土桥",
    "马驹桥",
    "台湖",
    "宋庄",
    "永顺",
    "潞城",
    "新华大街",
    "张家湾",
    "漷县",
    "西集",
    "永乐店",
    "于家务",
    "次渠",
    "运河",
    "玉桥",
    "中仓",
    "亦庄",
    "富力",
  ],
};

const argv = process.argv.slice(2);
const maxPages = Number((argv[argv.indexOf("--pages") + 1] ?? "").trim()) || 8;
const slow = argv.includes("--slow");
/** 只补详情：列表页被墙时也能把已有快照的开盘/交房/开发商补上，且可反复跑 */
const detailOnly = argv.includes("--detail-only");
const withDetail = detailOnly || !argv.includes("--no-detail");
const OUT = resolve("packages/core/src/content/newhouse.ts");
const CONCURRENCY = slow ? 2 : 3;
/** 非住宅项目：地块是土地成交、出租是长租，都不是"能买的盘" */
const SKIP_STATUS = new Set(["地块", "出租"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base, spread) => base + Math.floor(Math.random() * spread);

let cookieJar = new Map();

function mergeCookies(setCookies) {
  for (const line of setCookies) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) cookieJar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

function cookieHeader() {
  return [...cookieJar].map(([k, v]) => k + "=" + v).join("; ");
}

/** 验证页特征：滑块脚本 + 几百字节的空壳页 */
function isBlocked(html) {
  if (!html) return true;
  if (html.length < 3000) return true;
  return html.includes("checkyzm") || html.includes("请完成下列验证");
}

/**
 * 所有请求的唯一出口：限速 + UA 轮换 + cookie + 验证页退避。
 * 被墙时一次比一次等得久（8s / 16s / 24s），而不是换 IP 硬刷。
 */
async function getHtml(url, referer) {
  const tries = 5;
  for (let attempt = 1; attempt <= tries; attempt++) {
    await sleep(jitter(slow ? 2200 : 700, 700));
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UAS[attempt % UAS.length],
          referer: referer ?? "https://newhouse.fang.com/",
          "accept-language": "zh-CN,zh;q=0.9",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(cookieJar.size ? { cookie: cookieHeader() } : {}),
        },
        signal: AbortSignal.timeout(30000),
      });
      const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      if (setCookies.length) mergeCookies(setCookies);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = new TextDecoder("utf-8").decode(Buffer.from(await res.arrayBuffer()));
      if (isBlocked(html)) {
        const wait = 8000 * attempt;
        console.warn("   ⚠ 触发验证页，等 " + wait / 1000 + "s 重试（" + url + "）");
        await sleep(wait);
        continue;
      }
      return html;
    } catch (err) {
      if (attempt === tries) throw err;
      await sleep(900 * attempt);
    }
  }
  throw new Error("连续 " + tries + " 次没拿到正常页面：" + url);
}

function text(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function first(html, re) {
  const m = html.match(re);
  return m ? String(m[1]).trim() : "";
}

/** 列表页一条 <li id="lp_xxx"> → 项目记录。字段缺失留空，不猜。 */
function parseItem(block, district) {
  const id = first(block, /<li id="lp_(\d+)"/);
  if (!id) return null;
  const name = text(first(block, /<div class="nlcd_name"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/));
  if (!name) return null;

  const url = first(block, /href="(https:\/\/newhouse\.fang\.com\/loupan\/\d+\.htm)"/);
  const houseTypeBlob = first(block, /<div class="house_type[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const layouts = [...houseTypeBlob.matchAll(/>([^<>]{1,8}(?:居|室|厅|卫))</g)].map((m) => m[1].trim());
  const areaText = first(houseTypeBlob, /([\d.]+\s*[~-]\s*[\d.]+\s*平米)/);
  const addrTitle = first(block, /<div class="address"[^>]*><a title="([^"]*)"/);
  const ring = first(addrTitle, /^\[([^\]]+)\]/);
  const addrText = addrTitle.replace(/^\[[^\]]*\]\s*/, "");
  const districtTag = first(block, /<span class="sngrey">\s*\[([^\]]+)\]\s*<\/span>/);
  // 电话格子会拼上"转分机"，只认 400 段本体
  const phoneRaw = first(block, /<div class="tel">[\s\S]*?<p>([\s\S]*?)<\/p>/);
  const phone = (phoneRaw.match(/400\d{7}/) ?? [""])[0];
  const fangyuanBlob = first(block, /<div class="fangyuan"[^>]*>([\s\S]*?)<\/div>/);
  const saleStatus = text(first(fangyuanBlob, /^\s*<span class="[^"]*"[^>]*>([\s\S]*?)<\/span>/));
  const tags = [...fangyuanBlob.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim()).filter(Boolean);
  const image = first(block, /<img[^>]*alt="[^"]*"[^>]*src="(\/\/[^"]+)"/).replace(/^\/\//, "https://");

  // 价格有两种口径，必须分开：单价看"元/㎡"，总价看"万元/套"。
  // 以前把"420 万元/套起"当单价写进 priceAvg，别墅盘就成了 420 元/㎡的假数据。
  const priceText = text(first(block, /<div class="nhouse_price">([\s\S]*?)<\/div>/));
  const unitPrice = Number((priceText.match(/([\d.]+)\s*元\/㎡/) ?? [])[1]) || 0;
  let totalPriceFrom = Number((priceText.match(/([\d.]+)\s*万元\/套/) ?? [])[1]) || 0;
  const priceAvg = unitPrice >= 3000 && unitPrice <= 300000 ? Math.round(unitPrice) : null;
  if (!totalPriceFrom) {
    const zj = text(first(block, /<p class="zj_price">([\s\S]*?)<\/p>/));
    totalPriceFrom = Number((zj.match(/([\d.]+)\s*万/) ?? [])[1]) || 0;
  }
  const total = totalPriceFrom > 0 ? Math.round(totalPriceFrom) : null;

  const local = districtTag || district;
  const bizNames = BIZCIRCLES[local] ?? BIZCIRCLES[district] ?? [];
  const haystack = name + " " + addrText;
  const bizcircle =
    bizNames.filter((n) => haystack.includes(n)).sort((a, b) => b.length - a.length)[0] ?? "";

  return {
    uid: "fs-" + id,
    name,
    district: local,
    bizcircle,
    address: addrText,
    ring,
    priceAvg,
    priceText,
    totalPriceFrom: total,
    saleStatus,
    propertyType: tags[0] ?? "",
    tags: tags.slice(1),
    layouts: [...new Set(layouts)].join(" / "),
    areaText,
    phone,
    image,
    sourceUrl: url,
    openDate: "",
    deliveryDate: "",
    developer: "",
    decoration: "",
    buildingType: "",
    ownership: "",
    salesAddress: "",
    fetchedAt: new Date().toISOString(),
  };
}

/** 详情页 JSON-LD：PropertyValue 数组，name/value 成对；没有就退回正文正则。 */
function parseDetail(html) {
  const out = {};
  const re = /\{"@type":"PropertyValue","name":"([^"]+)","value":"([^"]*)"\}/g;
  for (const m of html.matchAll(re)) out[m[1]] = m[2];

  const fallback = (label, re2) => {
    const plain = text(html);
    return (plain.match(new RegExp(label + "\\s*[:：]?\\s*(" + re2 + ")")) ?? [])[1] ?? "";
  };

  return {
    openDate: out["开盘时间"] || fallback("开盘时间", "\\d{4}-\\d{1,2}-\\d{1,2}"),
    deliveryDate: out["交房时间"] || fallback("交房时间", "\\d{4}-\\d{1,2}-\\d{1,2}"),
    developer: out["开发商"] || "",
    decoration: out["装修状况"] || "",
    buildingType: out["建筑类别"] || "",
    ownership: out["产权年限"] || "",
    salesAddress: out["售楼地址"] || "",
  };
}

async function crawlDistrict(slug, name) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const url =
      page === 1
        ? "https://newhouse.fang.com/house/s/" + slug + "/"
        : "https://newhouse.fang.com/house/s/" + slug + "/b9" + page + "/";
    const html = await getHtml(url);
    const total = Number(first(html, /全部楼盘<span>\((\d+)\)/)) || null;
    const blocks = html.split('<li id="lp_').slice(1).map((s) => '<li id="lp_' + s);
    const pageItems = blocks.map((b) => parseItem(b, name)).filter(Boolean);
    console.log(
      "  " + name + " 第 " + page + " 页 → " + pageItems.length + " 条" + (total ? "（全部 " + total + "）" : ""),
    );
    if (!pageItems.length) break;
    for (const item of pageItems) if (!items.some((x) => x.uid === item.uid)) items.push(item);
    if (total && items.length >= total) break;
    if (pageItems.length < 20) break;
  }
  return items;
}

async function enrich(items) {
  let done = 0;
  const queue = [...items];
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try {
        const html = await getHtml(item.sourceUrl, "https://newhouse.fang.com/house/s/");
        const detail = parseDetail(html);
        for (const [k, v] of Object.entries(detail)) {
          if (v && !item[k]) item[k] = v;
        }
      } catch (err) {
        console.warn("   详情失败 " + item.name + ": " + err.message);
      }
      done += 1;
      if (done % 20 === 0) console.log("   详情 " + done + "/" + items.length);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

function toTs(rows) {
  return (
    "/**\n" +
    " * 新房事实快照：房天下 newhouse.fang.com 抓取（大兴 / 通州）。\n" +
    " *\n" +
    " * 抓数产物，不要手改：重抓走 scripts/crawl-newhouse.mjs。\n" +
    " * 生成时间 " +
    new Date().toISOString() +
    "，共 " +
    rows.length +
    " 个楼盘。\n" +
    " */\n\n" +
    'import type { NewProjectFact } from "../domain/newProject";\n\n' +
    "export const NEW_PROJECTS: NewProjectFact[] = " +
    JSON.stringify(rows, null, 2) +
    ";\n"
  );
}

/** 读现有快照（--detail-only 用）：JSON 数组就藏在 TS 文件的数组字面量里。 */
function readSnapshot() {
  const src = readFileSync(OUT, "utf8");
  const marker = "NewProjectFact[] = [";
  const start = src.indexOf(marker) + marker.length - 1;
  const end = src.lastIndexOf("];") + 1;
  if (start < 0 || end <= start) throw new Error("快照文件格式不认识：" + OUT);
  return JSON.parse(src.slice(start, end));
}

let usable;
if (detailOnly) {
  usable = readSnapshot();
  console.log("只补详情：现有快照 " + usable.length + " 个楼盘");
} else {
  const all = [];
  for (const d of DISTRICTS) {
    console.log("抓取 " + d.name + "…");
    const rows = await crawlDistrict(d.slug, d.name);
    console.log("  " + d.name + " 合计 " + rows.length + " 个楼盘");
    all.push(...rows);
  }
  usable = all.filter((row) => !SKIP_STATUS.has(row.saleStatus));
  const dropped = all.length - usable.length;
  if (dropped) console.log("剔除地块/出租等非住宅条目 " + dropped + " 个");
}

if (withDetail) {
  const todo = usable.filter((row) => !row.openDate || !row.developer);
  console.log("补详情页（开盘 / 交房 / 开发商 / 产权）：待补 " + todo.length + " / " + usable.length);
  await enrich(todo);
  for (const row of usable) row.fetchedAt = new Date().toISOString();
}

writeFileSync(OUT, toTs(usable));
const byDistrict = usable.reduce((acc, row) => {
  acc[row.district] = (acc[row.district] ?? 0) + 1;
  return acc;
}, {});
console.log(
  "写出 " + OUT + "：" + usable.length + " 个楼盘\n覆盖：" +
    Object.entries(byDistrict).map(([k, v]) => k + " " + v).join(" / "),
);
