import type {
  CheckRow,
  Community,
  DbStatus,
  House,
  HouseDetail,
  HouseInput,
  QualityRow,
  RuleSet,
  ShuttleLine,
  SyncReport,
} from "@house/core";
import { API_PREFIX, ApiRoutes, ErrorCodes, SYNC_TABLES } from "@house/protocol";
import type { PullResponse, PushRequest, PushResponse } from "@house/protocol";
import type { HouseRepo } from "./repo";
import { outbox } from "./outbox";
import { snapshot } from "./snapshot";

export interface ApiClientOptions {
  /** 同源部署时留空，走相对路径 /house-api。 */
  base?: string;
  /** Web 端令牌在 httpOnly cookie 里，不在这里；桌面/移动如需要可显式给。 */
  token?: string;
}

let base = API_PREFIX;
let token: string | null = null;

/**
 * 401 回调：令牌被服务端换掉（换库 / 吊销）时，调用方要能清掉本地这份死凭证，
 * 否则界面一直以为「已配对」，用户既看不到配对入口，重连也没有触发点。
 * 配对请求本身 401 是「配对码不对」，不是令牌失效，不回调。
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

/**
 * base 只该是「协议 + 主机 + 端口」。
 * 手填地址时经常把反代前缀 /house-api 一起贴进来，那样拼出来就是 /house-api/shuttle/lines，
 * 服务端认不出（Hono 默认回 404 Not Found 纯文本），前端 JSON.parse 直接炸。
 * 路径前缀由 ApiRoutes 统一带，所以这里见到就剥掉。
 */
function normalizeBase(raw: string): string {
  const next = raw.trim().replace(/\/+$/, "");
  if (!next) return API_PREFIX;
  // 显式给了绝对地址（桌面端 / 手机连远程服务器）时必须带反代前缀：
  // 线上 18766 的站点根出的是前端页面，只有 /house-api/ 才转后端，少这段会拿到 HTML 而不是 JSON。
  return next.endsWith(API_PREFIX) ? next : next + API_PREFIX;
}

export function configureApi(opts: ApiClientOptions): void {
  // 显式传空串＝切回同源（走 /house-api 反代或 dev proxy）；不传才保持上一次的地址
  if (opts.base !== undefined) base = opts.base ? normalizeBase(opts.base) : API_PREFIX;
  token = opts.token ?? null;
}

/** 所有 HTTP 的唯一起点：路径来自 @house/protocol，不允许手写第二遍。 */
export async function api<T>(route: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(base + route, { ...init, headers, credentials: "include" });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // 反代没转发、或地址多带了前缀时这里是纯文本 404，别让 JSON.parse 的报错盖掉真正原因
      const peek = text.slice(0, 60).replace(/\s+/g, " ").trim();
      throw new Error(
        `${res.status} ${ErrorCodes.internal}: 服务器返回了非 JSON 响应「${peek}」，检查服务器地址是否多带了 ${API_PREFIX}`,
      );
    }
  }
  if (!res.ok) {
    if (res.status === 401 && route !== ApiRoutes.authPair) onUnauthorized?.();
    const err = (body ?? {}) as { code?: string; message?: string };
    throw new Error(`${res.status} ${err.code ?? ErrorCodes.internal}: ${err.message ?? route}`);
  }
  return body as T;
}

export function pull(pageSince: number, tables?: string[]): Promise<PullResponse> {
  const qs = new URLSearchParams({ since: String(pageSince) });
  if (tables?.length) qs.set("tables", tables.join(","));
  return api<PullResponse>(`${ApiRoutes.syncPull}?${qs.toString()}`);
}

export function push(payload: PushRequest): Promise<PushResponse> {
  return api<PushResponse>(ApiRoutes.syncPush, { method: "POST", body: JSON.stringify(payload) });
}

/**
 * Web：直连 API 读，写操作进 IndexedDB outbox（ARCHITECTURE §3）。
 * 个人写表（待选/清单/打分）当前没有 REST 端点，P2 由 /sync/push 承载；
 * 在服务器上还没有这台设备的写入前，这里返回空集合而不是抛错，页面显示「暂无」。
 */
export class RemoteRepo implements HouseRepo {
  async status(): Promise<DbStatus> {
    const h = await api<{ rev: number; communities: number; version: string }>(ApiRoutes.health);
    return {
      path: "远程（服务器）",
      communities: h.communities ?? 0,
      persons: 0,
      lines: 0,
      stops: 0,
      routes: 0,
      rev: h.rev ?? 0,
      version: h.version,
    };
  }

  searchCommunities(q: string, limit = 50): Promise<Community[]> {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return api<Community[]>(`${ApiRoutes.communities}?${qs.toString()}`);
  }

  getCommunity(id: number): Promise<Community | null> {
    return api<Community | null>(ApiRoutes.community.replace(":uid", String(id)));
  }

  async upsertCommunity(input: { name: string; district?: string }): Promise<number> {
    // 服务器只认抓数建立的小区；手填的先入 outbox，等 push 后由 /sync/pull 分配 uid。
    // 返回值是本地句柄，Web 端没有自增 id，一律 0——页面用 uid 追踪。
    await outbox.enqueue({
      table: "community",
      uid: crypto.randomUUID(),
      op: "upsert",
      fields: { name: input.name, district: input.district ?? "", lng: 0, lat: 0 },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
    return 0;
  }

  async listShortlist(): Promise<Community[]> {
    // 快照来自 /sync/pull：待选行只存 uid + note，小区主体在 community 表里。
    const [short, communities] = await Promise.all([
      snapshot.rows("shortlist"),
      snapshot.rows("community"),
    ]);
    const byUid = new Map<string, Record<string, unknown>>();
    for (const c of communities) byUid.set(String(c.uid ?? ""), c);
    const out: Community[] = [];
    for (const s of short) {
      const c = byUid.get(String(s.community_uid ?? ""));
      if (c) out.push(toCommunity(c));
    }
    return out;
  }

  async addShortlist(communityId: number, note?: string): Promise<void> {
    await outbox.enqueue({
      table: "shortlist",
      uid: crypto.randomUUID(),
      op: "upsert",
      fields: { community_uid: String(communityId), note: note ?? null },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  async removeShortlist(communityId: number): Promise<void> {
    await outbox.enqueue({
      table: "shortlist",
      uid: String(communityId),
      op: "delete",
      fields: {},
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  async listQuality(communityId: number): Promise<QualityRow[]> {
    const rows = await snapshot.rows("community_quality");
    const key = String(communityId);
    return rows
      .filter((r) => String(r.community_uid ?? r.community_id ?? "") === key)
      .map((r) => ({
        itemKey: String(r.item_key ?? ""),
        valueNum: r.value_num == null ? null : Number(r.value_num),
        valueText: r.value_text == null ? null : String(r.value_text),
        source: r.source == null ? null : String(r.source),
        fetchedAt: r.fetched_at == null ? null : String(r.fetched_at),
      }));
  }

  async setQuality(
    communityId: number,
    itemKey: string,
    valueNum: number | null,
    valueText: string | null,
    source?: string,
  ): Promise<void> {
    await outbox.enqueue({
      table: "community_quality",
      uid: `${communityId}:${itemKey}`,
      op: "upsert",
      fields: { community_uid: String(communityId), item_key: itemKey, value_num: valueNum, value_text: valueText, source: source ?? "manual:web" },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  async listChecks(): Promise<CheckRow[]> {
    const rows = await snapshot.rows("check_state");
    return rows.map((r) => ({
      kind: String(r.kind ?? "") as CheckRow["kind"],
      itemKey: String(r.item_key ?? ""),
      checked: Number(r.checked ?? 0) === 1 || r.checked === true,
      note: r.note == null ? null : String(r.note),
      updatedAt: r.updated_at == null ? null : String(r.updated_at),
    }));
  }

  async setCheck(kind: string, itemKey: string, checked: boolean, note?: string): Promise<void> {
    await outbox.enqueue({
      table: "check_state",
      uid: `${kind}:${itemKey}`,
      op: "upsert",
      fields: { kind, item_key: itemKey, checked: checked ? 1 : 0, note: note ?? null },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  async getSettings(): Promise<Record<string, string>> {
    const rows = await snapshot.rows("app_setting");
    const out: Record<string, string> = {};
    for (const r of rows) {
      if (r.key != null && r.value != null) out[String(r.key)] = String(r.value);
    }
    return out;
  }

  async putSetting(key: string, value: string): Promise<void> {
    await outbox.enqueue({
      table: "app_setting",
      uid: key,
      op: "upsert",
      fields: { key, value },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  listLines(direction: "am" | "pm" = "am"): Promise<ShuttleLine[]> {
    void direction;
    return Promise.resolve([]);
  }

  listHouses(communityId: number): Promise<House[]> {
    void communityId;
    return Promise.resolve([]);
  }

  getHouse(id: number): Promise<HouseDetail | null> {
    void id;
    return Promise.resolve(null);
  }

  async saveHouse(input: HouseInput): Promise<number> {
    await outbox.enqueue({
      table: "house",
      uid: input.id ? String(input.id) : crypto.randomUUID(),
      op: "upsert",
      fields: { ...input },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
    return input.id ?? 0;
  }

  async deleteHouse(id: number): Promise<void> {
    await outbox.enqueue({
      table: "house",
      uid: String(id),
      op: "delete",
      fields: {},
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  async setHouseScore(houseId: number, itemKey: string, score: number | null): Promise<void> {
    await outbox.enqueue({
      table: "house_score",
      uid: `${houseId}:${itemKey}`,
      op: "upsert",
      fields: { house_uid: String(houseId), item_key: itemKey, score },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  async setHouseRedline(houseId: number, itemKey: string, hit: boolean): Promise<void> {
    await outbox.enqueue({
      table: "house_redline",
      uid: `${houseId}:${itemKey}`,
      op: "upsert",
      fields: { house_uid: String(houseId), item_key: itemKey, hit: hit ? 1 : 0 },
      baseRev: 0,
      clientTs: new Date().toISOString(),
    });
  }

  async sync(): Promise<SyncReport> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { pushed: 0, pulled: 0, conflicts: 0, rev: 0, ok: false, error: "offline" };
    }
    const REV_KEY = "house.sync.rev";
    let rev = Number(localStorage.getItem(REV_KEY) ?? 0);
    const pending = await outbox.peekAll(200);
    let pushed = 0;
    let conflicts = 0;
    if (pending.length) {
      const r = await push({
        deviceId: localStorage.getItem("house.deviceId") ?? "dev_unknown",
        items: pending.map((p) => ({ table: p.table, uid: p.uid, op: p.op, fields: p.fields, baseRev: p.baseRev, clientTs: p.clientTs })),
      });
      pushed = r.applied.length;
      conflicts = r.conflicts.length;
      rev = Math.max(rev, r.rev);
      await outbox.ack(r.applied.map((a) => a.uid));
      await outbox.ack(r.conflicts.map((c) => c.uid));
    }

    // Web 没有 SQLite：pull 回来的行落 IndexedDB 快照，list* 从快照读。
    let pulled = 0;
    for (let page = 0; page < 20; page += 1) {
      const body = await pull(rev, [...SYNC_TABLES]);
      const before = rev;
      pulled += await snapshot.savePage(body);
      if (body.rev > rev) rev = body.rev;
      if (!body.more || body.rev <= before) break;
    }
    localStorage.setItem(REV_KEY, String(rev));
    return { pushed, pulled, conflicts, rev, ok: true };
  }

  async rules(): Promise<RuleSet> {
    return api<RuleSet>(ApiRoutes.rules);
  }
}

/** 快照里的行是服务器原样（snake_case），这里统一成 @house/core 的 Community。 */
function toCommunity(row: Record<string, unknown>): Community {
  const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
  const str = (v: unknown): string | null => (v == null ? null : String(v));
  const pick = (camel: string, snake: string) => (row[camel] !== undefined ? row[camel] : row[snake]);
  return {
    uid: String(row.uid ?? ""),
    id: row.id == null ? undefined : Number(row.id),
    name: String(row.name ?? ""),
    district: String(row.district ?? ""),
    bizcircle: str(row.bizcircle),
    lng: Number(row.lng ?? 0),
    lat: Number(row.lat ?? 0),
    buildYear: num(pick("buildYear", "build_year")),
    buildType: str(pick("buildType", "build_type")),
    propertyType: str(pick("propertyType", "property_type")),
    price: num(row.price),
    priceTx: num(pick("priceTx", "price_tx")),
    priceSrcN: num(pick("priceSrcN", "price_src_n")),
    bargain: num(row.bargain),
    cycleDays: num(pick("cycleDays", "cycle_days")),
    txN: num(pick("txN", "tx_n")),
    online: row.online == null ? null : row.online === true || Number(row.online) === 1,
    address: str(row.address),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : String(row.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    source: str(row.source),
    fetchedAt: str(pick("fetchedAt", "fetched_at")),
    rev: Number(row.rev ?? 0),
  };
}
