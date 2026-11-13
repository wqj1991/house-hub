import type { Db } from "./db";

/** 客户端字段名是 camelCase，库里是 snake_case；只在这一层转。 */
export function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

const columnCache = new Map<string, Set<string>>();

/** 表名必须先过白名单（SYNC_TABLES / 固定集合），再进这个函数。 */
export function columnsOf(db: Db, table: string): Set<string> {
  let cached = columnCache.get(table);
  if (!cached) {
    const rows = db.pragma("table_info(" + table + ")") as { name: string }[];
    cached = new Set(rows.map((r) => r.name));
    columnCache.set(table, cached);
  }
  return cached;
}

const COLUMN_NAME = /^[a-z_][a-z0-9_]*$/;

/** 只留真实存在的列；名字不合法的一律丢掉，绝不拼进 SQL。 */
export function pickColumns(db: Db, table: string, fields: Record<string, unknown>) {
  const known = columnsOf(db, table);
  const values: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(fields)) {
    const key = toSnake(rawKey);
    if (!COLUMN_NAME.test(key) || !known.has(key)) continue;
    if (key === "id" || key === "rev" || key === "uid") continue;
    values[key] = normalize(value);
  }
  return values;
}

function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

/** community 行 → 页面 DTO（camelCase，布尔还原，tags 解 JSON）。 */
export function communityDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    district: row.district,
    bizcircle: row.bizcircle,
    lng: row.lng,
    lat: row.lat,
    buildYear: row.build_year,
    buildType: row.build_type,
    propertyType: row.property_type,
    price: row.price,
    priceTx: row.price_tx,
    priceSrcN: row.price_src_n,
    bargain: row.bargain,
    cycleDays: row.cycle_days,
    txN: row.tx_n,
    online: row.online === null || row.online === undefined ? null : Number(row.online) === 1,
    address: row.address,
    tags: parseTags(row.tags),
    source: row.source,
    fetchedAt: row.fetched_at,
    rev: row.rev,
  };
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(/[,，\s]+/).filter(Boolean);
  }
}
