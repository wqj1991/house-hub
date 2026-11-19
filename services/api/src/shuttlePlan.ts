import { formatClock, parseClock } from "@house/core";
import { routePath } from "./amap";
import type { Db } from "./db";

/**
 * 班车通勤的整条走法：家 →（骑行）→ 最近的上客点 →（班车）→ 公司。
 *
 * 为什么在服务端算：班车的站点在 line / stop 表里，骑行折线要高德规划，
 * 浏览器一次性问九条线几十个站会把配额和手机流量都烧掉。
 * 这里先按直线距离挑最近的几个站，只对它们各算一条骑行折线，再按「骑行 + 班车」
 * 的总分钟挑最快的一条 —— 「最近」以总耗时为准，直线最近的站不一定是上班最快的。
 */

export interface ShuttlePlanStop {
  uid: string;
  name: string;
  depart: string;
  lng: number;
  lat: number;
}

export interface ShuttlePlanAccess {
  /** 米 */
  distance: number;
  /** 秒 */
  duration: number;
  points: { lng: number; lat: number }[];
}

export interface ShuttlePlanView {
  code: string;
  name: string;
  /** 班车到公司时刻 HH:mm */
  arrive: string;
  stop: ShuttlePlanStop;
  /** 家 → 上客点的骑行折线 */
  access: ShuttlePlanAccess;
  /** 骑到站点的分钟（向上取整，倒推出门时刻用同一口径） */
  accessMinutes: number;
  /** 班车在车上的分钟（发车 → 到公司） */
  rideMinutes: number;
  /** 出门 → 到岗总分钟 */
  totalMinutes: number;
  /** 按发车时刻倒推的出门时刻 HH:mm */
  leaveHome: string;
  /** 最近几个站里真正算过骑行折线的个数 */
  considered: number;
}

interface StopRow {
  uid: string;
  name: string;
  depart: string;
  lng: number;
  lat: number;
}

interface LineRow {
  uid: string;
  name: string;
  arrive: string;
  stops: StopRow[];
}

/** 发车 → 到公司 的分钟；到点不晚于发车点按次日算（夜班/末班倒挂的情况）。 */
function rideMinutesBetween(depart: string, arrive: string): number | null {
  const from = parseClock(depart);
  const to = parseClock(arrive);
  if (from === null || to === null) return null;
  const gap = to - from;
  return gap >= 0 ? gap : gap + 24 * 60;
}

/** 两点直线距离（米）：只用来挑「最近几个站」，真实里程仍走高德。 */
function metresBetween(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 这处公司挂了哪些线路号：读通勤档案的归属表，没挂就用全部线路。 */
function boundCodes(db: Db, officeUid: string): string[] {
  if (!officeUid) return [];
  const row = db.prepare("select doc from commute_doc limit 1").get() as { doc: string } | undefined;
  if (!row) return [];
  try {
    const doc = JSON.parse(row.doc) as { shuttles?: Array<{ code?: unknown; officeUid?: unknown }> };
    const list = Array.isArray(doc.shuttles) ? doc.shuttles : [];
    return list
      .filter((item) => item && item.officeUid === officeUid && typeof item.code === "string")
      .map((item) => String(item.code).toUpperCase());
  } catch {
    return [];
  }
}

function loadLines(db: Db, codes: string[]): LineRow[] {
  const lineSql =
    "select id, uid, name, arrive_factory from line where deleted_at is null" +
    (codes.length ? " and uid in (" + codes.map(() => "?").join(",") + ")" : "") +
    " order by uid";
  const lines = db.prepare(lineSql).all(...codes) as Array<{
    id: number;
    uid: string;
    name: string;
    arrive_factory: string | null;
  }>;
  if (!lines.length) return [];

  const stopRows = db
    .prepare(
      "select line_id, uid, name, depart, lng, lat from stop " +
        "where deleted_at is null and line_id in (" +
        lines.map(() => "?").join(",") +
        ") order by line_id, seq",
    )
    .all(...lines.map((line) => line.id)) as Array<{
    line_id: number;
    uid: string;
    name: string;
    depart: string | null;
    lng: number;
    lat: number;
  }>;

  const grouped = new Map<number, StopRow[]>();
  for (const row of stopRows) {
    const list = grouped.get(row.line_id) ?? [];
    list.push({
      uid: row.uid,
      name: row.name,
      depart: row.depart ?? "",
      lng: Number(row.lng),
      lat: Number(row.lat),
    });
    grouped.set(row.line_id, list);
  }

  return lines.map((line) => ({
    uid: line.uid,
    name: line.name,
    arrive: line.arrive_factory ?? "",
    stops: grouped.get(line.id) ?? [],
  }));
}

export interface ShuttlePlanOptions {
  from: { lng: number; lat: number };
  officeUid: string;
  /** 指定线路号就只在这条线上找站；空串＝这处公司挂的所有线 */
  code?: string;
  /** 最多给几个最近的站算骑行折线（默认 6，够覆盖两三条线） */
  limit?: number;
}

export async function planShuttle(
  db: Db,
  key: string,
  opts: ShuttlePlanOptions,
): Promise<ShuttlePlanView | null> {
  const codes = opts.code ? [opts.code.toUpperCase()] : boundCodes(db, opts.officeUid);
  const lines = loadLines(db, codes);
  if (!lines.length) return null;

  const candidates: Array<{ line: LineRow; stop: StopRow; metres: number; ride: number }> = [];
  for (const line of lines) {
    for (const stop of line.stops) {
      if (!stop.depart || !stop.lng || !stop.lat) continue;
      const ride = rideMinutesBetween(stop.depart, line.arrive);
      if (ride === null) continue;
      candidates.push({ line, stop, metres: metresBetween(opts.from, stop), ride });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.metres - b.metres);

  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 12);
  const shortlist = candidates.slice(0, limit);

  let best: ShuttlePlanView | null = null;
  let considered = 0;
  for (const item of shortlist) {
    const access = await routePath(key, opts.from, { lng: item.stop.lng, lat: item.stop.lat }, "bike");
    // 算不出来（河对岸、没路）就跳过：宁可换下一个站，也不要一条假折线
    if (!access || access.points.length < 2) continue;
    considered += 1;
    const accessMinutes = Math.max(1, Math.ceil(access.duration / 60));
    const totalMinutes = accessMinutes + item.ride;
    if (best && totalMinutes >= best.totalMinutes) continue;
    const depart = parseClock(item.stop.depart);
    if (depart === null) continue;
    best = {
      code: item.line.uid,
      name: item.line.name,
      arrive: item.line.arrive,
      stop: item.stop,
      access: { distance: access.distance, duration: access.duration, points: access.points },
      accessMinutes,
      rideMinutes: item.ride,
      totalMinutes,
      leaveHome: formatClock(depart - accessMinutes),
      considered,
    };
  }

  if (best) best.considered = considered;
  return best;
}
