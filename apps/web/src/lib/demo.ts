import type { Community } from "@house/core";

/** 一行候选小区：库里的 Community + 展示层口径（通勤分钟来自实测记录）。 */
export interface Row {
  key: string;
  id: number | null;
  name: string;
  district: string;
  bizcircle: string | null;
  buildYear: number | null;
  /** 挂牌单价 元/㎡ */
  listed: number | null;
  /** 成交单价 元/㎡ */
  tx: number | null;
  area: number | null;
  /** 老公通勤（分钟），班车优先 */
  commuteA: number | null;
  modeA: string;
  /** 老婆通勤（分钟），公共交通 */
  commuteB: number | null;
  modeB: string;
  /** 购房资格是否核实（通州双限未核实 = false） */
  qualified: boolean;
  tags: string[];
}

const MODE_A = "班车";
const MODE_B = "公共交通";

/** 空库时的示例口径，用于把设计跑起来；真实数据来自 getRepo()。 */
export const DEMO_ROWS: Row[] = [
  {
    key: "demo-demaoyuan",
    id: null,
    name: "德茂佳苑",
    district: "大兴",
    bizcircle: "旧宫",
    buildYear: 2004,
    listed: 44200,
    tx: 42800,
    area: 89,
    commuteA: 62,
    modeA: MODE_A,
    commuteB: 88,
    modeB: MODE_B,
    qualified: true,
    tags: ["班车直达", "口径差 14′"],
  },
  {
    key: "demo-xiyuelinyu",
    id: null,
    name: "熙悦林语",
    district: "大兴",
    bizcircle: "亦庄",
    buildYear: 2018,
    listed: 44200,
    tx: 43100,
    area: 76,
    commuteA: 48,
    modeA: "电动车",
    commuteB: 78,
    modeB: MODE_B,
    qualified: true,
    tags: ["次新", "双线可达"],
  },
  {
    key: "demo-fangyuanli",
    id: null,
    name: "芳源里",
    district: "大兴",
    bizcircle: "瀛海",
    buildYear: 2008,
    listed: 40000,
    tx: 38600,
    area: 89,
    commuteA: 58,
    modeA: "自驾",
    commuteB: 96,
    modeB: MODE_B,
    qualified: true,
    tags: ["超筛 6′"],
  },
  {
    key: "demo-tanxiangfu",
    id: null,
    name: "檀香府",
    district: "通州",
    bizcircle: "梨园",
    buildYear: 2015,
    listed: 46800,
    tx: 45200,
    area: 92,
    commuteA: 72,
    modeA: MODE_A,
    commuteB: 85,
    modeB: MODE_B,
    qualified: false,
    tags: ["通州双限", "资格未核实"],
  },
  {
    key: "demo-heyuechunfeng",
    id: null,
    name: "和悦春风",
    district: "昌平",
    bizcircle: "回龙观",
    buildYear: 2013,
    listed: 41600,
    tx: 39800,
    area: 88,
    commuteA: 68,
    modeA: MODE_A,
    commuteB: 79,
    modeB: MODE_B,
    qualified: true,
    tags: ["13 号线"],
  },
];

/** 实测通勤分钟（小区名 → 双人门到门），库表暂存不下，先放在这里。 */
const COMMUTE: Record<string, [number, number, string]> = {
  德茂佳苑: [62, 88, MODE_A],
  熙悦林语: [48, 78, "电动车"],
  芳源里: [58, 96, "自驾"],
  檀香府: [72, 85, MODE_A],
  和悦春风: [68, 79, MODE_A],
  海怡东方: [74, 90, MODE_A],
};

export function toRow(c: Community): Row {
  const known = COMMUTE[c.name];
  return {
    key: c.uid,
    id: c.id ?? null,
    name: c.name,
    district: c.district || "—",
    bizcircle: c.bizcircle,
    buildYear: c.buildYear,
    listed: c.price,
    tx: c.priceTx,
    area: null,
    commuteA: known ? known[0] : null,
    modeA: known ? known[2] : "待录",
    commuteB: known ? known[1] : null,
    modeB: MODE_B,
    qualified: c.district !== "通州",
    tags: c.tags ?? [],
  };
}

/** 主榜排序：按较差一侧排序，超 90′ 沉底。 */
export function worseSide(r: Row): number {
  return Math.max(r.commuteA ?? 0, r.commuteB ?? 0);
}

export function sortByWorse(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    const ax = a.commuteA == null && a.commuteB == null ? 999 : worseSide(a);
    const bx = b.commuteA == null && b.commuteB == null ? 999 : worseSide(b);
    return ax - bx;
  });
}

export type Verdict = "ok" | "warn" | "bad" | "unknown";

/** 单程硬筛 ≤ 90′；> 80′ 标黄；资格未核实直接红标。 */
export function verdictOf(r: Row): Verdict {
  if (!r.qualified) return "bad";
  const worst = worseSide(r);
  if (r.commuteA == null && r.commuteB == null) return "unknown";
  if (worst > 90) return "bad";
  if (worst > 80) return "warn";
  return "ok";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  ok: "绿标",
  warn: "黄标",
  bad: "红标",
  unknown: "待录",
};

export function wan(unitPrice: number | null, area: number | null): number | null {
  if (unitPrice == null || area == null) return null;
  return Math.round((unitPrice * area) / 10000);
}
