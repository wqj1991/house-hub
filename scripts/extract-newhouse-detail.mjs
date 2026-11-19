#!/usr/bin/env node
/**
 * 从房天下抽「地图坐标 + 完整户型」，生成 packages/core/src/content/newhouseDetail.ts，
 * 并把户型图下载到 apps/web/public/huxing/<uid>-d<户型id>.jpg。
 *
 * 两个来源：
 *   ① 户型相册页 /loupan/<id>/photo/list_900_3_1.htm —— 户型主来源，一页给全（含楼层奇偶、
 *      几室几厅几卫、建面），详情页那个「户型」区块只挂 8 个且缺标题；
 *   ② 楼盘详情页 —— 只取 JSON-LD 的 geo 坐标；户型页没条目时回退它的户型区块；
 *   ③ 户型详情页 /loupan/<id>/photo/d_house_<户型id>.htm —— 有就取「测评图」（带房间面积与
 *      空间评价的彩色户型图，748x600），存成 <uid>-d<户型id>-cp.<ext>。这一页能直连，不必走 jina。
 *
 * 缓存：D:/dsh/cache/house/jina/<uid>.html（详情页）、D:/dsh/cache/house/huxing/<uid>.md（户型页），
 * 都是 r.jina.ai 抓的文本；房天下直连会被导去 check.3g.fang.com 滑块页，所以一律走 jina。
 *
 * 用法：
 *   node scripts/extract-newhouse-detail.mjs             // 抽数据 + 补户型图
 *   node scripts/extract-newhouse-detail.mjs --no-image  // 只抽数据，不下图
 *   node scripts/extract-newhouse-detail.mjs --force     // 缓存与已存在的户型图都重抓/重下
 *   node scripts/extract-newhouse-detail.mjs --limit 5   // 只处理前 5 个，调试用
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(ROOT, "packages/core/src/content/newhouse.ts");
const OUT = join(ROOT, "packages/core/src/content/newhouseDetail.ts");
const CACHE = "D:/dsh/cache/house/jina";
const HX_CACHE = "D:/dsh/cache/house/huxing";
const HOUSE_CACHE = "D:/dsh/cache/house/housedetail";
const IMG_DIR = join(ROOT, "apps/web/public/huxing");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REFERER = "https://newhouse.fang.com/";
const MAX_PLANS = 24;
const REVIEW_EXTS = [".jpg", ".png", ".webp"];
const CP_CONCURRENCY = 4;

const argv = process.argv.slice(2);
const NO_IMAGE = argv.includes("--no-image");
const FORCE = argv.includes("--force");
const NO_REVIEW = argv.includes("--no-review");
const limIdx = argv.indexOf("--limit");
const LIMIT = limIdx >= 0 ? Number(argv[limIdx + 1]) || 0 : 0;

/** BD-09（百度坐标）→ GCJ-02（高德/腾讯坐标）；房天下 JSON-LD 的 geo 是百度系，不换算会偏 700-900 米。 */
function bd09ToGcj(lng, lat) {
  const xPi = (Math.PI * 3000) / 180;
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * xPi);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * xPi);
  return [z * Math.cos(theta), z * Math.sin(theta)];
}

/** 快照里每个条目都是 JSON 对象，整段 parse 拿 uid/name/address/sourceUrl。 */
function readSnapshot() {
  const text = readFileSync(SNAPSHOT, "utf8");
  const start = text.indexOf("= [");
  const end = text.lastIndexOf("];");
  if (start < 0 || end < 0) throw new Error("newhouse.ts 结构变了：找不到 NEW_PROJECTS 数组");
  const rows = JSON.parse(text.slice(start + 2, end + 1));
  return rows.map((r) => ({ uid: r.uid, name: r.name, address: r.address || "", sourceUrl: r.sourceUrl || "" }));
}

function cachePath(uid) {
  return join(CACHE, uid + ".html");
}

/** 缺页就现抓一次（r.jina.ai 已证明能过房天下），抓不到返回 null。 */
function readPage(uid) {
  const p = cachePath(uid);
  if (existsSync(p)) return readFileSync(p, "utf8");
  const url = "https://r.jina.ai/https://newhouse.fang.com/loupan/" + uid.replace(/^fs-/, "") + ".htm";
  try {
    const body = execFileSync("curl", ["-sSfL", "--max-time", "60", "-A", UA, url], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (body.length < 5000) return null;
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(p, body);
    return body;
  } catch {
    return null;
  }
}

function parseGeo(html) {
  const m = html.match(/"geo":\{"@type":"GeoCoordinates","latitude":(-?[\d.]+),"longitude":(-?[\d.]+)\}/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < 73 || lng > 136 || lat < 3 || lat > 54) return null;
  return { lng, lat };
}

/** 户型相册页：走 jina 的 markdown，缺页现抓一次；404（盘已下架）返回空串。 */
function readHuxingPage(uid) {
  const p = join(HX_CACHE, uid + ".md");
  if (existsSync(p)) return readFileSync(p, "utf8");
  const url =
    "https://r.jina.ai/https://newhouse.fang.com/loupan/" + uid.replace(/^fs-/, "") + "/photo/list_900_3_1.htm";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body = execFileSync("curl", ["-sSL", "--max-time", "60", "-A", UA, url], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      if (body.length < 2000) continue;
      mkdirSync(HX_CACHE, { recursive: true });
      writeFileSync(p, body);
      return body;
    } catch {
      /* 再试一次 */
    }
  }
  return "";
}

/**
 * 户型页条目（jina markdown 一行一条）：
 *   *   [![Image 19: 111平户型（偶数层）](…/200x150.jpg?t=1) 111平户型（偶数层）](…/d_house_131019.htm)
 *   [4室2厅1厨2卫 111㎡(建面)](…/d_house_131019.htm)
 * 名称取自图片 alt（比详情页的 h3 多了「奇数层/偶数层」这类有效信息），结构+面积取下一行。
 */
function parseHuxingPage(md, uid) {
  const plans = [];
  const seen = new Set();
  const itemRe =
    /!\[Image \d+: ([^\]]*)\]\((https?:[^)\s]+)\)[^\]]*\]\(https:\/\/newhouse\.fang\.com\/loupan\/\d+\/photo\/d_house_(\d+)\.htm\)/g;
  let m;
  while ((m = itemRe.exec(md)) && plans.length < MAX_PLANS) {
    const houseId = m[3];
    if (seen.has(houseId)) continue;
    seen.add(houseId);
    const alt = m[1].trim();
    const rest = md.slice(m.index, m.index + 400);
    const shape = rest.match(/(\d+室\d+厅\d+厨\d+卫)\s*([\d.]+)\s*㎡/);
    const layout = shape ? shape[1] : "";
    const area = shape ? Number(shape[2]) : NaN;
    plans.push({
      name: alt || layout || "户型",
      layout,
      area: Number.isFinite(area) && area > 0 ? area : null,
      tags: [],
      image: "",
      imageRemote: bigImage(m[2]),
      sourceUrl: "https://newhouse.fang.com/loupan/" + uid.replace(/^fs-/, "") + "/photo/d_house_" + houseId + ".htm",
      houseId,
    });
  }
  return plans;
}

/** 户型区：<div class="layout_con"><ul><li>…</li></ul></div>，li 里是图 + 名称 + 卖点 + 建面。 */
function parseFloorPlans(html, uid) {
  const anchor = html.indexOf('class="layout_con"');
  if (anchor < 0) return [];
  const window = html.slice(anchor, anchor + 12000);
  const ul = window.indexOf("<ul");
  const ulEnd = window.indexOf("</ul>", ul);
  if (ul < 0 || ulEnd < 0) return [];
  const body = window.slice(ul, ulEnd);
  const plans = [];
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = liRe.exec(body)) && plans.length < MAX_PLANS) {
    const li = m[1];
    const img = (li.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
    const href = (li.match(/href="(\/loupan\/[^"]*photo\/[^"]+)"/) || [])[1] || "";
    const name = ((li.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || "").replace(/<[^>]+>/g, "").trim();
    if (!name) continue;
    const tagBlock = (li.match(/class="layout_tag[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "";
    const tags = [];
    const spanRe = /<span[^>]*>([\s\S]*?)<\/span>/g;
    let s;
    while ((s = spanRe.exec(tagBlock))) {
      const t = s[1].replace(/<[^>]+>/g, "").trim();
      if (t) tags.push(t);
    }
    const areaM = li.match(/建面\s*([\d.]+)\s*㎡/);
    const area = areaM ? Number(areaM[1]) : null;
    const n = plans.length + 1;
    plans.push({
      name,
      layout: /^\d+室\d+厅\d+厨\d+卫$/.test(name) ? name : "",
      area: Number.isFinite(area) && area > 0 ? area : null,
      tags: tags.slice(0, 4),
      image: "/huxing/" + uid + "-" + n + ".jpg",
      imageRemote: bigImage(img),
      sourceUrl: href ? "https://newhouse.fang.com" + href : "",
      houseId: (href.match(/d_house_(\d+)\.htm/) || [])[1] || "",
    });
  }
  return plans;
}

/** 缩略图换成 640 大图；soufunimg 的路径末段就是尺寸。扩展名要原样保留（老图床 .jpg，新房源 .jpeg）。 */
function bigImage(src) {
  if (!src) return "";
  const url = src.startsWith("//") ? "https:" + src : src;
  return url.replace(/\/\d+x\d+\.(jpe?g|png|webp)/, "/640x640.$1");
}

/**
 * 户型详情页：房天下直连会被导去 check.3g.fang.com 滑块（并发抓几十个后必拦），所以与相册页一样走 jina。
 * 缺页现抓一次，拿到滑块页/空页返回空串。
 */
function readHousePage(uid, houseId) {
  if (!houseId) return "";
  const p = join(HOUSE_CACHE, uid + "-" + houseId + ".html");
  if (existsSync(p)) return readFileSync(p, "utf8");
  const url =
    "https://r.jina.ai/https://newhouse.fang.com/loupan/" +
    uid.replace(/^fs-/, "") +
    "/photo/d_house_" +
    houseId +
    ".htm";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body = execFileSync("curl", ["-sSL", "--max-time", "90", "--connect-timeout", "8", "-A", UA, url], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      if (body.length < 5000 || body.includes("check.html")) continue;
      mkdirSync(HOUSE_CACHE, { recursive: true });
      writeFileSync(p, body);
      return body;
    } catch {
      /* 再试一次 */
    }
  }
  return "";
}

/**
 * 户型页里的「测评图」（房天下给每套户型配的彩图：房间面积 + 空间适中/宽敞 + 尺寸线）。
 * 图床路径带 huxing 段，跟户型主图的 house 段分得开；同页会出现缩略与 748x600 两档，取最大那档。
 * 页面没这条（多数老盘）就返回空串，前端不显示任何占位。
 */
const REVIEW_IMG_RE = /((?:https?:)?\/\/[\w.]+\/viewimage\/(?:huxing|house)\/[^"' )]+?\/(\d+)x(\d+)\.(png|jpe?g)\?t=1)/g;

function normImgUrl(raw) {
  const url = raw.startsWith("//") ? "https:" + raw : raw;
  return url.replace(/\/\d+x\d+\.(png|jpe?g)\?t=1$/, "/748x600.$1?t=1");
}

function parseReviewImage(html) {
  if (!html || !html.includes("测评图")) return "";
  // 第一优先：<p>测评图</p> 所在 <li> 的 data-imgBig（新房源的测评图挂在 viewimage/house 段，
  // 跟同页主户型图只差 uuid，只能靠 li 归属区分）
  const liRe = /<li\b[\s\S]{0,4000}?<\/li>/g;
  let li;
  while ((li = liRe.exec(html))) {
    const chunk = li[0];
    if (!chunk.includes("测评图")) continue;
    const big = chunk.match(/data-imgBig="((?:https?:)?\/\/[^"]+?)"/);
    if (big) return normImgUrl(big[1]);
    const img = chunk.match(/<img[^>]+src="((?:https?:)?\/\/[^"]+?)"/);
    if (img) return normImgUrl(img[1]);
  }
  // 第二优先：标签前 900 字符内最近的图（无 li 包裹的老模板）
  for (let i = html.indexOf("测评图"); i !== -1; i = html.indexOf("测评图", i + 1)) {
    const before = html.slice(Math.max(0, i - 900), i);
    const all = [...before.matchAll(REVIEW_IMG_RE)];
    if (all.length) return normImgUrl(all[all.length - 1][1]);
  }
  // 兜底：全页最大尺寸的 huxing 段图
  const hits = new Map();
  let m;
  const re = new RegExp(REVIEW_IMG_RE.source, "g");
  while ((m = re.exec(html))) hits.set(normImgUrl(m[1]), Number(m[2]) * Number(m[3]));
  let best = "";
  let bestArea = 0;
  for (const [url, area] of hits) {
    if (url.includes("/huxing/") && area > bestArea) {
      best = url;
      bestArea = area;
    }
  }
  return best;
}

/** 测评图存盘：按 magic bytes 定扩展名（房天下有 image/jpeg 却叫 .png 的情况）。 */
async function downloadReview(url, base) {
  if (!url) return "";
  const tmp = base + ".tmp";
  if (!(await curlTo(url, tmp))) {
    rmSync(tmp, { force: true });
    return "";
  }
  const buf = readFileSync(tmp);
  if (buf.length < 2000) {
    rmSync(tmp, { force: true });
    return "";
  }
  const ext = buf[0] === 0x89 && buf[1] === 0x50 ? ".png" : buf[0] === 0x52 && buf[1] === 0x49 ? ".webp" : ".jpg";
  writeFileSync(base + ext, buf);
  for (const other of REVIEW_EXTS) if (other !== ext) rmSync(base + other, { force: true });
  rmSync(tmp, { force: true });
  return ext;
}

/** 大图 404 时逐级往下降，别让一个尺寸档位把整个户型丢掉。 */
function imageCandidates(url) {
  if (!url) return [];
  return [url, url.replace(/\/640x640\./, "/400x300."), url.replace(/\/640x640\./, "/200x150.")];
}

function download(url, dest) {
  if (!url) return false;
  try {
    execFileSync(
      "curl",
      ["-sSfL", "--max-time", "45", "-A", UA, "-e", REFERER, "-o", dest, url],
      { stdio: "ignore" },
    );
    const size = readFileSync(dest).length;
    if (size < 2000) throw new Error("too small: " + size);
    return true;
  } catch {
    return false;
  }
}

/** 异步 curl：并发抓页用，同步版一排就是几分钟。 */
function curlTo(url, dest, maxTime = 30) {
  return new Promise((resolve) => {
    const child = spawn(
      "curl",
      ["-sSL", "--max-time", String(maxTime), "--connect-timeout", "8", "-A", UA, "-o", dest, url],
      { stdio: "ignore" },
    );
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

/** 有界并发：房天下对密集请求敏感，默认 6 路就够了。 */
async function pool(items, limit, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) await task(items[cursor++]);
  });
  await Promise.all(workers);
}

/** 先把所有户型详情页并发抓下来（命中缓存就跳过），后面的同步主循环只读磁盘。 */
async function prefetchHousePages(pairs) {
  const todo = pairs.filter(({ uid, houseId }) => !existsSync(join(HOUSE_CACHE, uid + "-" + houseId + ".html")));
  if (!todo.length) return;
  mkdirSync(HOUSE_CACHE, { recursive: true });
  let done = 0;
  await pool(todo, CP_CONCURRENCY, async ({ uid, houseId }) => {
    const dest = join(HOUSE_CACHE, uid + "-" + houseId + ".html");
    const tmp = dest + ".part";
    const url =
      "https://r.jina.ai/https://newhouse.fang.com/loupan/" + uid.replace(/^fs-/, "") + "/photo/d_house_" + houseId + ".htm";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await curlTo(url, tmp, 90)) {
        const body = readFileSync(tmp, "utf8");
        // jina 免费额度打满会回 429/限流文案，退避后再来
        if (body.length > 3000 && !/^\s*(429|Too Many Requests)|rate limit/i.test(body.slice(0, 400))) {
          if (!body.includes("check.html")) writeFileSync(dest, body);
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 15000));
    }
    rmSync(tmp, { force: true });
    if (++done % 25 === 0 || done === todo.length) console.log("  户型页 " + done + "/" + todo.length);
  });
}

/** 预取测评图：返回 base → { status, ext }，主循环据此写 reviewImage。 */
async function prefetchReviewImages(list) {
  const result = new Map();
  const todo = [];
  for (const item of list) {
    const exist = REVIEW_EXTS.find((x) => existsSync(item.base + x));
    if (exist && !FORCE) result.set(item.base, { status: "ok", ext: exist });
    else todo.push(item);
  }
  if (!todo.length) return result;
  let done = 0;
  await pool(todo, CP_CONCURRENCY, async ({ uid, houseId, base }) => {
    const url = parseReviewImage(readHousePage(uid, houseId));
    if (!url) {
      result.set(base, { status: "none" });
    } else {
      const ext = await downloadReview(url, base);
      result.set(base, ext ? { status: "ok", ext } : { status: "fail" });
    }
    if (++done % 25 === 0 || done === todo.length) console.log("  测评图 " + done + "/" + todo.length);
  });
  return result;
}

const projects = readSnapshot();
const picked = LIMIT ? projects.slice(0, LIMIT) : projects;
mkdirSync(IMG_DIR, { recursive: true });

// 第一遍：只读缓存拿坐标与户型清单，缺页才现抓详情页/户型页
const scanned = [];
const missing = [];
for (const p of picked) {
  const html = readPage(p.uid);
  if (!html) {
    missing.push(p.uid);
    continue;
  }
  const geo = parseGeo(html);
  // 户型主来源是户型相册页；它没条目（无户型相册的盘）才回退详情页那个 8 个上限的区块
  const fromDetail = parseFloorPlans(html, p.uid);
  const fromAlbum = parseHuxingPage(readHuxingPage(p.uid), p.uid);
  const plans = fromAlbum.length ? fromAlbum : fromDetail;
  // 户型页没有「户型方正/采光充足」这类卖点，按几室几厅几卫从详情页那条借回来
  if (fromAlbum.length) {
    const tagsByLayout = new Map();
    for (const d of fromDetail) if (d.layout && d.tags.length) tagsByLayout.set(d.layout, d.tags);
    for (const plan of plans) {
      const borrowed = tagsByLayout.get(plan.layout);
      if (borrowed) plan.tags = borrowed;
    }
  }
  scanned.push({ p, geo, plans });
}

// 第二遍：户型详情页与测评图先并发落盘，后面的主循环只做同步搬运
const reviewBases = new Map();
const cpResults = new Map();
const pairs = [];
const cpList = [];
{
  const seenPair = new Set();
  for (const { p, plans } of scanned) {
    for (const plan of plans) {
      if (!plan.houseId) continue;
      const key = p.uid + "-" + plan.houseId;
      if (!seenPair.has(key)) {
        seenPair.add(key);
        pairs.push({ uid: p.uid, houseId: plan.houseId });
      }
      const base = join(IMG_DIR, p.uid + "-d" + plan.houseId + "-cp");
      if (!reviewBases.has(base)) {
        reviewBases.set(base, plan.houseId);
        cpList.push({ uid: p.uid, houseId: plan.houseId, base });
      }
    }
  }
}

if (NO_REVIEW) {
  // 只认盘上已有的测评图（--no-review 时不去房天下取页面）
  for (const base of reviewBases.keys()) {
    const ext = REVIEW_EXTS.find((x) => existsSync(base + x));
    if (ext) cpResults.set(base, { status: "ok", ext });
  }
} else if (!NO_IMAGE) {
  console.log("户型详情页 " + pairs.length + " 个、测评图 " + cpList.length + " 张，并发 " + CP_CONCURRENCY);
  await prefetchHousePages(pairs);
  for (const [base, v] of await prefetchReviewImages(cpList)) cpResults.set(base, v);
}

const out = {};
let withGeo = 0;
let withPlans = 0;
let imgOk = 0;
let imgFail = 0;
let cpPlans = 0;
let cpFail = 0;

for (const { p, geo, plans } of scanned) {
  if (geo) withGeo++;
  if (plans.length) withPlans++;

  let gcj = null;
  if (geo) {
    const [lng, lat] = bd09ToGcj(geo.lng, geo.lat);
    gcj = { lng: Number(lng.toFixed(6)), lat: Number(lat.toFixed(6)) };
  }

  const kept = [];
  for (const plan of plans) {
    // 文件名带户型 id：重抓时同一户型还是同一张图，不会因为排序变了就串图
    const slug = plan.houseId ? "d" + plan.houseId : String(kept.length + 1);
    const rel = "/huxing/" + p.uid + "-" + slug + ".jpg";
    const dest = join(IMG_DIR, p.uid + "-" + slug + ".jpg");
    if (!NO_IMAGE) {
      if (FORCE || !existsSync(dest)) {
        const ok = imageCandidates(plan.imageRemote).some((url) => download(url, dest));
        if (ok) imgOk++;
        else {
          imgFail++;
          continue; // 没下到图的户型不进快照，前端就不会给死链
        }
      } else imgOk++;
    }
    // 测评图：主图之外的第二张图，房天下有就给，没有就是空串（前端不显示占位）
    const cp = plan.houseId ? cpResults.get(join(IMG_DIR, p.uid + "-" + slug + "-cp")) : undefined;
    let review = "";
    if (cp?.status === "ok") {
      review = "/huxing/" + p.uid + "-" + slug + "-cp" + cp.ext;
      cpPlans++;
    } else if (cp?.status === "fail") cpFail++;
    const { houseId, ...rest } = plan;
    kept.push({ ...rest, image: rel, reviewImage: review });
  }

  if (gcj || kept.length) {
    out[p.uid] = { lng: gcj ? gcj.lng : null, lat: gcj ? gcj.lat : null, floorPlans: kept };
  }
}

const stamp = new Date().toISOString();
const lines = [];
lines.push("// 新房详情附加事实：地图落点（GCJ-02）+ 户型清单，由 scripts/extract-newhouse-detail.mjs 生成，别手改。");
lines.push("// 坐标来源：详情页 JSON-LD geo（BD-09 已换算成 GCJ-02）；户型来源：户型相册页 list_900_3_1.htm（无相册时回退详情页户型区）。");
lines.push("// 生成时间 " + stamp + "，覆盖 " + Object.keys(out).length + "/" + projects.length + " 个楼盘。");
lines.push('import type { NewProjectDetailFact } from "../domain/newProject";');
lines.push("");
lines.push("export const NEW_PROJECT_DETAILS: Record<string, NewProjectDetailFact> = {");
for (const [uid, v] of Object.entries(out)) {
  lines.push("  " + JSON.stringify(uid) + ": " + JSON.stringify(v, null, 2).replace(/\n/g, "\n  ") + ",");
}
lines.push("};");
lines.push("");
writeFileSync(OUT, lines.join("\n"));

console.log(
  "写入 " + OUT +
    "：楼盘 " + Object.keys(out).length + "，有坐标 " + withGeo + "，有户型 " + withPlans +
    "，图成功 " + imgOk + "，图失败 " + imgFail + "，测评图 " + cpPlans + "，测评图失败 " + cpFail +
    "，缺页 " + missing.length,
);
if (missing.length) console.log("缺页（详情页没抓到，本次跳过）：" + missing.join(", "));

// 清理这轮没引用的旧图（老命名 <uid>-<n>.jpg 换成了 <uid>-d<id>.jpg）
const used = new Set();
for (const v of Object.values(out)) {
  for (const plan of v.floorPlans) {
    used.add(plan.image.replace("/huxing/", ""));
    if (plan.reviewImage) used.add(plan.reviewImage.replace("/huxing/", ""));
  }
}
let dropped = 0;
if (!LIMIT) {
  for (const f of readdirSync(IMG_DIR)) {
    if (!/\.(jpe?g|png|webp)$/.test(f) || used.has(f)) continue;
    rmSync(join(IMG_DIR, f));
    dropped++;
  }
}

const files = readdirSync(IMG_DIR).filter((f) => /\.(jpe?g|png|webp)$/.test(f));
const bytes = files.reduce((n, f) => n + readFileSync(join(IMG_DIR, f)).length, 0);
if (dropped) console.log("清掉旧户型图 " + dropped + " 张");
console.log("public/huxing：" + files.length + " 张，" + (bytes / 1024 / 1024).toFixed(1) + " MB");
if (!LIMIT && withGeo < projects.length * 0.6) console.log("警告：坐标覆盖率偏低，检查详情页缓存是否过期");
