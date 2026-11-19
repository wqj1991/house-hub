#!/usr/bin/env node
/**
 * 吉屋（m.jiwu.com）新房爬虫：房天下被 IP 级封禁后，用吉屋补「开盘 / 交房 / 产权」等详情。
 * 只做本地取证用途：限速 + 串行/低并发 + 只抓列表与详情页。
 *
 * 用法：
 *   node scripts/crawl-jiwu.mjs --index                 抓北京全量列表，输出名称→id 索引
 *   node scripts/crawl-jiwu.mjs --enrich                按索引补 packages/core/src/content/newhouse.ts 的空字段
 *   node scripts/crawl-jiwu.mjs --index --pages 12      限制页数（调试用）
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT = resolve(ROOT, "packages/core/src/content/newhouse.ts");
const CACHE = "D:/dsh/cache/house";
const INDEX_FILE = CACHE + "/jiwu-index.json";
const DETAIL_CACHE = CACHE + "/jiwu-detail";

const argv = process.argv.slice(2);
const modeIndex = argv.includes("--index");
const modeEnrich = argv.includes("--enrich");
const maxPages = Number((argv[argv.indexOf("--pages") + 1] ?? "").trim()) || 40;
const SLOW_MS = Number((argv[argv.indexOf("--slow") + 1] ?? "").trim()) || 900;

const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_DESK =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** 公司网出口：curl 必须显式指定代理（脚本 env 为空，不继承 shell 的 HTTP_PROXY）。 */
const PROXY = "http://127.0.0.1:17890";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => sleep(SLOW_MS * (0.7 + Math.random() * 0.6));

/**
 * 吉屋对 Node 的 fetch 会返回「请求验证页面」（708 字节 JS 挑战），只对 curl 放行，
 * 所以统一走系统 curl 取页面，Node 只负责编排与解析。
 */
let curlSeq = 0;
function curlGet(url) {
  // Windows 自带的 curl.exe 写管道时会被 spawnSync 抓到空串，改成 -o 落盘再读，稳。
  const ua = Math.random() < 0.5 ? UA_MOBILE : UA_DESK;
  mkdirSync(CACHE + "/tmp", { recursive: true });
  const file = CACHE + "/tmp/get-" + process.pid + "-" + ++curlSeq + ".html";
  // 脚本进程的 env 是空的（不继承 shell），必须自己带代理与 SystemRoot，否则 curl 直连 443 超时。
  const env = {
    SystemRoot: "C:\\Windows",
    windir: "C:\\Windows",
    PATH: "C:\\Windows\\System32;C:\\Windows",
    TEMP: "D:\\dsh\\cache\\tmp",
    TMP: "D:\\dsh\\cache\\tmp",
    HTTP_PROXY: PROXY,
    HTTPS_PROXY: PROXY,
    http_proxy: PROXY,
    https_proxy: PROXY,
    NO_PROXY: "localhost,127.0.0.1",
  };
  const res = spawnSync(
    "curl",
    ["-sS", "-m", "25", "--compressed", "-A", ua, "-H", "accept-language: zh-CN,zh;q=0.9", "-L", "-o", file, url],
    { encoding: "utf8", env },
  );
  if (res.status !== 0) throw new Error("curl " + res.status + " " + String(res.stderr).slice(0, 80));
  const html = readFileSync(file, "utf8");
  try {
    rmSync(file);
  } catch {}
  return html;
}

async function get(url, attempt = 1) {
  try {
    const html = curlGet(url);
    if (html.length < 2000 || html.includes("请求验证页面")) {
      throw new Error("len " + html.length + " (验证页)");
    }
    return html;
  } catch (err) {
    if (attempt >= 4) throw err;
    const wait = 4000 * attempt;
    console.warn("  重试 " + attempt + "/3：" + String(err).slice(0, 90) + " → 等 " + wait / 1000 + "s");
    await sleep(wait);
    return get(url, attempt + 1);
  }
}

/** 名称归一：去空白、去间隔号、半角方括号统一，用于跨站匹配。 */
function normName(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[·・•]/g, "")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .trim();
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function crawlIndex() {
  mkdirSync(CACHE, { recursive: true });
  const index = {};
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? "https://m.jiwu.com/bj/loupan/" : "https://m.jiwu.com/bj/loupan/list-page" + page + ".html";
    let html;
    try {
      html = await get(url);
    } catch (err) {
      console.log("第 " + page + " 页抓取失败，停止：" + String(err).slice(0, 80));
      break;
    }
    const re = /data-bid="(\d+)"[\s\S]{0,400}?href="https:\/\/m\.jiwu\.com\/bj\/loupan\/\1\.html"\s+title="([^"]+)"/g;
    let m;
    let added = 0;
    while ((m = re.exec(html))) {
      const [, id, name] = m;
      const key = normName(name);
      if (key && !index[key]) {
        index[key] = { id, name };
        added++;
      }
    }
    console.log("第 " + page + " 页：" + added + " 条（累计 " + Object.keys(index).length + "）");
    if (!added) break;
    await jitter();
  }
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 1), "utf8");
  console.log("索引写入 " + INDEX_FILE + "，共 " + Object.keys(index).length + " 个盘");
  return index;
}

/** 详情页解析：开盘 / 交房 / 产权 / 楼栋 / 户数 / 板块 / 地址 / 均价。 */
function parseDetail(html, name) {
  const lines = stripTags(html);
  const out = {};
  const take = (label) => {
    const i = lines.findIndex((s) => s.replace(/[：:]$/, "") === label);
    return i >= 0 ? (lines[i + 1] ?? "") : "";
  };
  const openDate = take("开盘");
  const deliveryDate = take("交房");
  const ownership = take("产权");
  if (/^\d{4}-\d{2}-\d{2}$/.test(openDate)) out.openDate = openDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) out.deliveryDate = deliveryDate;
  if (/\d+年/.test(ownership)) out.ownership = ownership;

  // 位置行：「昌平 | - | 东小口 | - | 详细地址」
  const i = lines.indexOf("位置");
  if (i > 0) {
    const seg = lines.slice(i + 1, i + 8);
    const district = seg.find((s) => /区|县$/.test(s));
    if (district) out.district = district;
    const biz = seg.find((s) => s && s !== "-" && s !== district && !/^(发地址|测评)/.test(s) && /[\u4e00-\u9fa5]{2,8}$/.test(s));
    if (biz && biz !== district) out.bizcircle = biz;
    const addr = seg.find((s) => s.length > 8 && /路|街|镇|村|道|号/.test(s));
    if (addr) out.address = addr;
  }
  const price = html.match(/(\d{4,6})\s*<\/span>\s*元\/m/);
  if (price) out.priceAvg = Number(price[1]);
  out.title = (html.match(/<title>([^_<]+)/) || [])[1] || name;
  return out;
}

async function crawlDetail(id) {
  mkdirSync(DETAIL_CACHE, { recursive: true });
  const file = DETAIL_CACHE + "/" + id + ".html";
  try {
    return readFileSync(file, "utf8");
  } catch {}
  const html = await get("https://m.jiwu.com/bj/loupan/" + id + ".html");
  writeFileSync(file, html, "utf8");
  return html;
}

/** 读快照数组（TS 文件里的字面量）。 */
function readSnapshot() {
  const src = readFileSync(SNAPSHOT, "utf8");
  const marker = "NewProjectFact[] = [";
  const start = src.indexOf(marker) + marker.length - 1;
  const end = src.lastIndexOf("];") + 1;
  return JSON.parse(src.slice(start, end));
}

async function enrich() {
  const index = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
  const rows = readSnapshot();
  const hit = [];
  const miss = [];
  const ambiguous = [];
  for (const row of rows) {
    const key = normName(row.name);
    let entry = index[key];
    if (!entry) {
      // 兜底：去掉尾部「·XX」之类的子名后模糊包含匹配，但要求唯一
      const cands = Object.entries(index).filter(([k]) => k.includes(key) || key.includes(k));
      if (cands.length === 1) entry = cands[0][1];
      else if (cands.length > 1) ambiguous.push(row.name + " → " + cands.map(([k]) => k).join(" / "));
    }
    if (entry) hit.push({ row, entry });
    else miss.push(row.name);
  }
  console.log("吉屋能对上的：" + hit.length + " / " + rows.length + "（歧义 " + ambiguous.length + "，未收录 " + miss.length + "）");
  if (ambiguous.length) console.log("歧义跳过：" + ambiguous.slice(0, 8).join("; "));

  let changed = 0;
  let fetched = 0;
  for (const [i, item] of hit.entries()) {
    const { row, entry } = item;
    let html;
    try {
      html = await crawlDetail(entry.id);
    } catch (err) {
      console.warn("  [" + (i + 1) + "/" + hit.length + "] " + row.name + " 详情失败：" + String(err).slice(0, 70));
      await jitter();
      continue;
    }
    fetched++;
    const d = parseDetail(html, entry.name);
    const patch = {};
    if (!row.openDate && d.openDate) patch.openDate = d.openDate;
    if (!row.deliveryDate && d.deliveryDate) patch.deliveryDate = d.deliveryDate;
    if (!row.ownership && d.ownership) patch.ownership = d.ownership;
    if (!row.bizcircle && d.bizcircle && d.bizcircle.length <= 10) patch.bizcircle = d.bizcircle;
    if (!row.address && d.address) patch.address = d.address;
    if (Object.keys(patch).length) {
      Object.assign(row, patch, { fetchedAt: new Date().toISOString() });
      changed++;
      console.log("  [" + (i + 1) + "/" + hit.length + "] " + row.name + " ← " + JSON.stringify(patch));
    }
    await jitter();
  }

  const header =
    "// 由 scripts/crawl-newhouse.mjs（房天下列表）+ scripts/crawl-jiwu.mjs（吉屋详情补全）生成\n" +
    "// 生成时间 " + new Date().toISOString() + "，共 " + rows.length + " 个楼盘\n" +
    "// 大兴 / 通州在售与待售新盘；地块与出租类条目已剔除\n";
  const body = JSON.stringify(rows, null, 2);
  writeFileSync(
    SNAPSHOT,
    header +
      'import type { NewProjectFact } from "../domain/newProject";\n\n' +
      "export const NEW_PROJECTS: NewProjectFact[] = " + body + ";\n",
    "utf8",
  );
  const withOpen = rows.filter((r) => r.openDate).length;
  const withDev = rows.filter((r) => r.developer).length;
  const withBiz = rows.filter((r) => r.bizcircle).length;
  console.log("详情抓取 " + fetched + " 个，更新 " + changed + " 条；开盘 " + withOpen + "、开发商 " + withDev + "、板块 " + withBiz + " / " + rows.length);
}

if (modeIndex) await crawlIndex();
if (modeEnrich) await enrich();
if (!modeIndex && !modeEnrich) console.log("用法：--index 或 --enrich（可加 --pages N / --slow MS）");
