import { setTimeout as delay } from "node:timers/promises";

/**
 * 高德 Web 服务代理：Key 只住在服务端环境变量里，客户端只拿到「名字 + 地址 + 坐标」。
 *
 * 三件事写死在这一层：
 * - 串行限速：个人 Key 的 QPS 很低，连打会回 CUQPS_HAS_EXCEEDED_THE_LIMIT，宁可排队也不报错。
 * - 短期缓存：同一关键词 30 秒内只打一次高德，边打字边搜不至于把日配额烧完。
 * - 只认带坐标的命中：没有 location 的候选直接丢掉，保证「选中即可定位」。
 */

const AMAP_HOST = "https://restapi.amap.com";
const MIN_INTERVAL_MS = 260;
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 200;
const RETRY = 3;

/** 一条可用于公司地点的候选：poiId 是「来自高德」的凭据，坐标是后面算通勤时长的输入。 */
export interface AmapPlace {
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  adcode: string;
  lng: number;
  lat: number;
  typecode: string;
}

export class AmapError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AmapError";
  }
}

/* ────────────── 限速闸门：所有请求排一队，任意两次之间至少 260ms ────────────── */

let gate: Promise<unknown> = Promise.resolve();
let lastAt = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = gate.then(async () => {
    const wait = lastAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await delay(wait);
    try {
      return await task();
    } finally {
      lastAt = Date.now();
    }
  });
  gate = run.then(
    () => undefined,
    () => undefined,
  );
  return run as Promise<T>;
}

/* ────────────── 缓存 ────────────── */

const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function remember(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

/* ────────────── 字段清洗：高德很多字段「没有就是空数组」 ────────────── */

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = text(item);
      if (s) return s;
    }
  }
  return "";
}

function coord(raw: unknown): { lng: number; lat: number } | null {
  const [lngRaw, latRaw] = text(raw).split(",");
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng === 0 && lat === 0) return null;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return { lng: Math.round(lng * 1e6) / 1e6, lat: Math.round(lat * 1e6) / 1e6 };
}

function toPlace(row: Record<string, unknown>): AmapPlace | null {
  const point = coord(row.location);
  if (!point) return null;
  const name = text(row.name);
  if (!name) return null;
  return {
    id: text(row.id),
    name,
    address: text(row.address),
    city: text(row.cityname) || text(row.city),
    district: text(row.adname) || text(row.district),
    adcode: text(row.adcode),
    lng: point.lng,
    lat: point.lat,
    typecode: text(row.typecode),
  };
}

function rows(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

/* ────────────── 请求 ────────────── */

interface RawAnswer {
  status?: string;
  info?: string;
  infocode?: string;
  /** 骑行是 v4 接口：成功判 errcode === 0，没有 status */
  errcode?: number;
  errmsg?: string;
}

async function request(key: string, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, key });
  const url = AMAP_HOST + path + "?" + qs.toString();
  let lastInfo = "";

  for (let attempt = 1; attempt <= RETRY; attempt += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new AmapError("高德接口 HTTP " + res.status, "amap_http");
    const json = (await res.json()) as RawAnswer & Record<string, unknown>;
    if (json.status === "1" || json.errcode === 0) return json;

    lastInfo = text(json.info) || text(json.errmsg) || text(json.infocode) || text(json.errcode) || "未知错误";
    const info = text(json.infocode);
    const retriable = /QPS|LIMIT|BUSY|TIMEOUT/i.test(lastInfo) || info === "10004";
    if (!retriable) break;
    await delay(400 * attempt);
  }

  if (/INVALID_USER_KEY|USERKEY|SERVICE_NOT_AVAILABLE/i.test(lastInfo)) {
    throw new AmapError("高德 Key 无效或被禁用：" + lastInfo, "amap_key_invalid");
  }
  throw new AmapError("高德返回失败：" + (lastInfo || "未知错误"), "amap_failed");
}

/* ────────────── 对外：地点检索 / 地理编码 ────────────── */

export function amapConfigured(key: string): boolean {
  return Boolean(key && key.trim());
}

function requireKey(key: string): string {
  const clean = (key ?? "").trim();
  if (!clean) throw new AmapError("服务端还没有配置高德 Key（HOUSE_AMAP_KEY）", "amap_unconfigured");
  return clean;
}

/** 关键词 → 候选地点。先 inputtips（打字即出、快），不够再用 place/text 补足。 */
export async function searchPlaces(
  key: string,
  query: string,
  opts: { city?: string; limit?: number } = {},
): Promise<AmapPlace[]> {
  const k = requireKey(key);
  const q = (query ?? "").trim();
  if (q.length < 2) return [];

  const city = (opts.city ?? "").trim();
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20);
  const cacheKey = "search|" + city + "|" + q + "|" + limit;
  const hit = cached<AmapPlace[]>(cacheKey);
  if (hit) return hit;

  const places = await schedule(async () => {
    const tips = await request(k, "/v3/assistant/inputtips", {
      keywords: q,
      ...(city ? { city } : {}),
      citylimit: "false",
      datatype: "all",
    });
    const fromTips = rows(tips.tips)
      .map(toPlace)
      .filter((row): row is AmapPlace => row !== null);

    if (fromTips.length >= limit) return fromTips.slice(0, limit);

    const pois = await request(k, "/v3/place/text", {
      keywords: q,
      ...(city ? { city } : {}),
      citylimit: "false",
      offset: String(limit),
      page: "1",
      extensions: "base",
    });
    const merged = [...fromTips];
    const seen = new Set(merged.map((row) => row.id || row.name + "|" + row.lng + "," + row.lat));
    for (const row of rows(pois.pois)) {
      const place = toPlace(row);
      if (!place) continue;
      const id = place.id || place.name + "|" + place.lng + "," + place.lat;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(place);
      if (merged.length >= limit) break;
    }
    return merged;
  });

  remember(cacheKey, places);
  return places;
}

/** 门牌地址 → 坐标。地理编码没有 POI id，用坐标拼一个稳定的 id 顶替。 */
export async function geocodeAddress(
  key: string,
  address: string,
  opts: { city?: string } = {},
): Promise<AmapPlace | null> {
  const k = requireKey(key);
  const addr = (address ?? "").trim();
  if (!addr) return null;

  const city = (opts.city ?? "").trim();
  const cacheKey = "geo|" + city + "|" + addr;
  const hit = cached<AmapPlace | null>(cacheKey);
  if (hit !== null) return hit;

  const place = await schedule(async () => {
    const json = await request(k, "/v3/geocode/geo", {
      address: addr,
      ...(city ? { city } : {}),
    });
    const row = rows(json.geocodes)[0];
    if (!row) return null;
    const formatted = text(row.formatted_address) || addr;
    const built = toPlace({ ...row, name: formatted, address: formatted });
    if (!built) return null;
    return { ...built, id: "geo:" + built.lng.toFixed(6) + "," + built.lat.toFixed(6) };
  });

  remember(cacheKey, place);
  return place;
}

/* ────────────── 对外：路线折线（给前端画真实路线） ────────────── */

/** 前端能画的四种走法：通勤习惯的 vehicle 去掉班车（班车是站点表，不是折线）。 */
export type AmapRouteMode = "drive" | "transit" | "walk" | "bike";

export const AMAP_ROUTE_MODES: AmapRouteMode[] = ["drive", "transit", "walk", "bike"];

/** 一段路径：点串已经是 GCJ-02，前端直接喂给 Polyline。 */
export interface AmapRoutePath {
  mode: AmapRouteMode;
  distance: number;
  duration: number;
  points: { lng: number; lat: number }[];
  /** 公交/地铁方案坐到的线路名（如「地铁8号线」「快速公交3线」）；其他走法为空 */
  lines: string[];
}

/**
 * 两个坐标之间的路径（驾车 / 公交地铁 / 步行 / 骑行）。
 *
 * 为什么走服务端而不是浏览器的 AMap.Driving 插件：插件内部会带 s=rsv3 打
 * restapi.amap.com/v3/direction/driving，这把 Key 没开数字签名，直接回
 * USERKEY_PLAT_NOMATCH（10009）。去掉 platform/s 参数后同一把 Key 是通的，
 * 所以折线一律在这里算完，只把点串下发；顺带复用限速闸门和缓存。
 */
export async function routePath(
  key: string,
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  mode: AmapRouteMode = "drive",
  opts: { city?: string } = {},
): Promise<AmapRoutePath | null> {
  const k = requireKey(key);
  const fmt = (point: { lng: number; lat: number }) => point.lng.toFixed(6) + "," + point.lat.toFixed(6);
  const city = (opts.city ?? "").trim();
  const cacheKey = "route|" + mode + "|" + fmt(from) + "|" + fmt(to) + "|" + city;
  const hit = cached<AmapRoutePath | null>(cacheKey);
  if (hit !== null) return hit;

  const path = await schedule(async () => {
    if (mode === "transit") return transitPath(k, from, to, city);
    if (mode === "walk") return walkPath(k, from, to);
    if (mode === "bike") return bikePath(k, from, to);
    return drivePath(k, from, to);
  });

  remember(cacheKey, path);
  return path;
}

/** 高德的 polyline 是「lng,lat;lng,lat」，相邻重复点去掉，折线别原地抖。 */
function pushPolyline(points: { lng: number; lat: number }[], raw: unknown): void {
  for (const pair of text(raw).split(";")) {
    const point = coord(pair);
    if (!point) continue;
    const last = points[points.length - 1];
    if (last && last.lng === point.lng && last.lat === point.lat) continue;
    points.push(point);
  }
}

/** 把 steps[] 的 polyline 依次拼进同一条折线。 */
function pushSteps(points: { lng: number; lat: number }[], steps: unknown): void {
  for (const step of rows(steps)) pushPolyline(points, step.polyline);
}

/** "地铁8号线(朱辛庄--南锣鼓巷)" → "地铁8号线"：只留坐的是哪条线。 */
function lineName(raw: unknown): string {
  return text(raw).replace(/[（(].*$/, "").trim();
}

async function drivePath(
  key: string,
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
): Promise<AmapRoutePath | null> {
  const fmt = (point: { lng: number; lat: number }) => point.lng.toFixed(6) + "," + point.lat.toFixed(6);
  const json = await request(key, "/v3/direction/driving", {
    origin: fmt(from),
    destination: fmt(to),
    strategy: "0",
    extensions: "base",
  });
  const route = json.route as Record<string, unknown> | undefined;
  const first = rows(route?.paths)[0];
  if (!first) return null;

  const points: { lng: number; lat: number }[] = [];
  pushSteps(points, first.steps);
  if (points.length < 2) return null;
  return {
    mode: "drive",
    distance: Number(text(first.distance)) || 0,
    duration: Number(text(first.duration)) || 0,
    points,
    lines: [],
  };
}

async function walkPath(
  key: string,
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
): Promise<AmapRoutePath | null> {
  const fmt = (point: { lng: number; lat: number }) => point.lng.toFixed(6) + "," + point.lat.toFixed(6);
  const json = await request(key, "/v3/direction/walking", {
    origin: fmt(from),
    destination: fmt(to),
  });
  const route = json.route as Record<string, unknown> | undefined;
  const first = rows(route?.paths)[0];
  if (!first) return null;

  const points: { lng: number; lat: number }[] = [];
  pushSteps(points, first.steps);
  if (points.length < 2) return null;
  return {
    mode: "walk",
    distance: Number(text(first.distance)) || 0,
    duration: Number(text(first.duration)) || 0,
    points,
    lines: [],
  };
}

/** 骑行是 v4 接口：paths 挂在 data 下面，成功判 errcode === 0。 */
async function bikePath(
  key: string,
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
): Promise<AmapRoutePath | null> {
  const fmt = (point: { lng: number; lat: number }) => point.lng.toFixed(6) + "," + point.lat.toFixed(6);
  const json = await request(key, "/v4/direction/bicycling", {
    origin: fmt(from),
    destination: fmt(to),
  });
  const data = json.data as Record<string, unknown> | undefined;
  const first = rows(data?.paths)[0];
  if (!first) return null;

  const points: { lng: number; lat: number }[] = [];
  pushSteps(points, first.steps);
  if (points.length < 2) return null;
  return {
    mode: "bike",
    distance: Number(text(first.distance)) || 0,
    duration: Number(text(first.duration)) || 0,
    points,
    lines: [],
  };
}

/**
 * 公交 / 地铁：优先第一条推荐方案，折线由「步行段 + 每条公交的 polyline」拼成。
 * city 必填（高德按城市查公交），用服务端配的默认城市兜底。
 */
async function transitPath(
  key: string,
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  city: string,
): Promise<AmapRoutePath | null> {
  const fmt = (point: { lng: number; lat: number }) => point.lng.toFixed(6) + "," + point.lat.toFixed(6);
  const json = await request(key, "/v3/direction/transit/integrated", {
    origin: fmt(from),
    destination: fmt(to),
    ...(city ? { city } : {}),
    strategy: "0",
    // 只要 base 就拿不到公交线路的 polyline，画线必须 all
    extensions: "all",
  });
  const route = json.route as Record<string, unknown> | undefined;
  const first = rows(route?.transits)[0];
  if (!first) return null;

  const points: { lng: number; lat: number }[] = [];
  const lines: string[] = [];
  for (const segment of rows(first.segments)) {
    const walking = segment.walking as Record<string, unknown> | undefined;
    if (walking) pushSteps(points, walking.steps);

    const bus = segment.bus as Record<string, unknown> | undefined;
    for (const line of rows(bus?.buslines)) {
      pushPolyline(points, line.polyline);
      const name = lineName(line.name);
      if (name && !lines.includes(name)) lines.push(name);
    }

    // 铁路段没有 polyline，只能用上下车站的坐标连一条直线
    const railway = segment.railway as Record<string, unknown> | undefined;
    if (railway) {
      const departure = railway.departure_stop as Record<string, unknown> | undefined;
      const arrival = railway.arrival_stop as Record<string, unknown> | undefined;
      pushPolyline(points, departure?.location);
      pushPolyline(points, arrival?.location);
      const name = lineName(railway.name);
      if (name && !lines.includes(name)) lines.push(name);
    }
  }
  if (points.length < 2) return null;
  return {
    mode: "transit",
    distance: Number(text(first.distance)) || 0,
    duration: Number(text(first.duration)) || 0,
    points,
    lines,
  };
}
