import { Hono } from "hono";
import {
  ApiRoutes,
  FIELD_OWNER,
  SERVER_ONLY_TABLES,
  SERVER_OWNED_COMMUNITY_FIELDS,
  SYNC_TABLES,
} from "@house/protocol";
import type { PullResponse, PushConflict, PushItem, PushResponse, SyncTable } from "@house/protocol";
import { schema } from "@house/core";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import { currentRev, nextRev } from "../db";
import type { Db } from "../db";
import { columnsOf, pickColumns } from "../wire";

/** 单表单页行数；一页 500 行足够一个家庭的全部私有数据。 */
const PAGE = 500;

type ApplyResult = { ok: true; rev: number } | { ok: false; conflict: PushConflict };

function isSyncTable(table: string): table is SyncTable {
  return (SYNC_TABLES as readonly string[]).includes(table);
}

function ownerOf(table: string): string {
  const map = FIELD_OWNER as Record<string, string>;
  return map[table] ?? "client";
}

function conflict(uid: string, reason: string, rev: number): PushConflict {
  return { uid, winner: "server", rev, reason };
}

/** 三条纪律：白名单表、服务端独有字段丢弃、冲突按所有权表裁决（ARCHITECTURE §6.5）。 */
function applyOne(db: Db, item: PushItem): ApplyResult {
  const table = item.table as string;
  if (!isSyncTable(table)) return { ok: false, conflict: conflict(item.uid, "unknown_table", currentRev(db)) };
  if ((SERVER_ONLY_TABLES as readonly string[]).includes(table)) {
    return { ok: false, conflict: conflict(item.uid, "server_owned_table", currentRev(db)) };
  }

  const existing = db.prepare("select rev from " + table + " where uid = ?").get(item.uid) as
    | { rev: number }
    | undefined;

  if (item.op === "delete") {
    if (!existing) return { ok: false, conflict: conflict(item.uid, "delete_missing_row", currentRev(db)) };
    const rev = nextRev(db);
    db.prepare("update " + table + " set deleted_at = datetime('now'), rev = ? where uid = ?").run(rev, item.uid);
    return { ok: true, rev };
  }

  const fields: Record<string, unknown> = { ...item.fields };
  // 已有行：抓来的价格/坐标/成交不让客户端盖掉；新行照收——第一版就是用户手填的
  if (existing && table === "community") {
    for (const key of SERVER_OWNED_COMMUNITY_FIELDS) {
      delete fields[key];
      delete fields[key.replace(/_([a-z])/g, (_m, ch: string) => ch.toUpperCase())];
    }
  }
  if (existing && table === "community_quality") delete fields.fetched_at;

  if (existing && Number(existing.rev) > item.baseRev && ownerOf(table) === "server") {
    return { ok: false, conflict: conflict(item.uid, "stale_base_rev", Number(existing.rev)) };
  }

  const values = pickColumns(db, table, fields);
  const known = columnsOf(db, table);
  if (known.has("updated_at")) values.updated_at = new Date().toISOString();
  if (known.has("deleted_at") && existing) values.deleted_at = null;

  const names = Object.keys(values);
  if (!existing && names.length === 0) {
    return { ok: false, conflict: conflict(item.uid, "empty_fields", currentRev(db)) };
  }

  const rev = nextRev(db);
  try {
    if (existing) {
      // 更新走 update：upsert 的 insert 半边会先撞 NOT NULL，把「只改部分字段」直接判死
      const sets = [...names.map((n) => n + " = ?"), "rev = ?"].join(", ");
      db.prepare("update " + table + " set " + sets + " where uid = ?").run(
        ...names.map((n) => values[n]),
        rev,
        item.uid,
      );
    } else {
      const insertCols = ["uid", ...names, "rev"];
      db.prepare(
        "insert into " + table + " (" + insertCols.join(", ") + ") values (" +
          insertCols.map(() => "?").join(", ") + ")",
      ).run(item.uid, ...names.map((n) => values[n]), rev);
    }
  } catch (err) {
    // 真实原因只进日志：客户端只需要知道「这行没写进去，拉回来对一遍」
    console.error("[sync] apply failed", table, item.uid, (err as Error).message, names.join(","));
    return { ok: false, conflict: conflict(item.uid, "invalid_fields", currentRev(db)) };
  }
  return { ok: true, rev };
}

export function syncRoutes(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);

  app.get(ApiRoutes.syncPull, auth, (c) => {
    const q = schema.pullQuerySchema.parse({ since: c.req.query("since"), tables: c.req.query("tables") });
    const requested = q.tables ? q.tables.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const wanted = (requested.length ? requested.filter(isSyncTable) : (SYNC_TABLES as readonly SyncTable[])) as SyncTable[];
    const since = q.since;

    const perTable = new Map<SyncTable, Record<string, unknown>[]>();
    let cap = Number.MAX_SAFE_INTEGER;
    let truncated = false;

    for (const table of wanted) {
      const rows = db
        .prepare("select * from " + table + " where rev > ? order by rev asc limit ?")
        .all(since, PAGE + 1) as Record<string, unknown>[];
      if (rows.length > PAGE) {
        truncated = true;
        const lastKept = rows[PAGE - 1] as Record<string, unknown>;
        cap = Math.min(cap, Number(lastKept.rev));
        rows.length = PAGE;
      }
      perTable.set(table, rows);
    }

    const rows: Record<string, unknown[]> = {};
    const deleted: Record<string, string[]> = {};
    let maxRev = since;

    for (const table of wanted) {
      for (const row of perTable.get(table) ?? []) {
        if (Number(row.rev) > cap) continue;
        maxRev = Math.max(maxRev, Number(row.rev));
        if (row.deleted_at) {
          (deleted[table] ??= []).push(String(row.uid));
        } else {
          (rows[table] ??= []).push(row);
        }
      }
    }

    const body: PullResponse = {
      rev: maxRev,
      rows: rows as PullResponse["rows"],
      deleted: deleted as PullResponse["deleted"],
      // 只有被截断才让客户端再拉一次；否则 since 不变会空转
      more: truncated,
    };
    return c.json(body);
  });

  app.post(ApiRoutes.syncPush, auth, async (c) => {
    const body = schema.pushBodySchema.parse(await c.req.json());
    const applied: { uid: string; rev: number }[] = [];
    const conflicts: PushConflict[] = [];
    const now = Date.now();
    let skew = 0;

    db.transaction(() => {
      for (const item of body.items as PushItem[]) {
        const ts = Date.parse(item.clientTs);
        if (Number.isFinite(ts)) skew = Math.max(skew, Math.abs(now - ts));
        const result = applyOne(db, item);
        if (result.ok) applied.push({ uid: item.uid, rev: result.rev });
        else conflicts.push(result.conflict);
      }
    })();

    const response: PushResponse = { applied, conflicts, rev: currentRev(db) };
    if (skew > 120000) response.clockSkewMs = skew;
    return c.json(response);
  });

  return app;
}
