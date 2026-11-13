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
import { API_PREFIX, ApiRoutes, ErrorCodes } from "@house/protocol";
import type { PullResponse, PushRequest, PushResponse } from "@house/protocol";
import type { HouseRepo } from "./repo";
import { outbox } from "./outbox";

export interface ApiClientOptions {
  /** 同源部署时留空，走相对路径 /house-api。 */
  base?: string;
  /** Web 端令牌在 httpOnly cookie 里，不在这里；桌面/移动如需要可显式给。 */
  token?: string;
}

let base = API_PREFIX;
let token: string | null = null;

export function configureApi(opts: ApiClientOptions): void {
  if (opts.base) base = opts.base.replace(/\/$/, "");
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
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
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
    void input;
    // TODO(P1): 服务器暂不接受新建小区（抓数才建）；本地先落 outbox，等后台建库。
    return 0;
  }

  listShortlist(): Promise<Community[]> {
    // TODO(P2): 从 /sync/pull 的快照读。
    return Promise.resolve([]);
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

  listQuality(communityId: number): Promise<QualityRow[]> {
    void communityId;
    return Promise.resolve([]);
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

  listChecks(): Promise<CheckRow[]> {
    return Promise.resolve([]);
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

  getSettings(): Promise<Record<string, string>> {
    return Promise.resolve({});
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
    if (!navigator.onLine) return { pushed: 0, pulled: 0, conflicts: 0, rev: 0, ok: false, error: "offline" };
    const pending = await outbox.peekAll(200);
    let pushed = 0;
    let conflicts = 0;
    let rev = 0;
    if (pending.length) {
      const r = await push({
        deviceId: localStorage.getItem("house.deviceId") ?? "dev_unknown",
        items: pending.map((p) => ({ table: p.table, uid: p.uid, op: p.op, fields: p.fields, baseRev: p.baseRev, clientTs: p.clientTs })),
      });
      pushed = r.applied.length;
      conflicts = r.conflicts.length;
      rev = r.rev;
      await outbox.ack(r.applied.map((a) => a.uid));
      await outbox.ack(r.conflicts.map((c) => c.uid));
    }
    return { pushed, pulled: 0, conflicts, rev, ok: true };
  }

  async rules(): Promise<RuleSet> {
    return api<RuleSet>(ApiRoutes.rules);
  }
}
