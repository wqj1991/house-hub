import { Hono } from "hono";
import { SHUTTLE_ROUTES, SHUTTLE_TERMINAL, schema } from "@house/core";
import type { ShuttleRouteStop } from "@house/core";
import { ApiRoutes } from "@house/protocol";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import { nextRev } from "../db";
import type { Db } from "../db";
import { unbindShuttle } from "./commute";

/**
 * 班车线路库：和通勤画像完全独立的一块。
 *
 * 第一次启动用 core 里的固定时刻表 seed 进去，之后就以库为准——用户可以加线路、
 * 改司机电话、增删站点。表结构没动：line.uid 就是线路号（Y01…），
 * line.driver 一列存「姓名 电话」（空格分隔），坐标进 stop.lng/lat（GCJ-02）。
 */

export interface ShuttleStopView {
  /** 站点在库里的 uid（线路号-序号）：编辑时按它对行 */
  uid: string;
  seq: number;
  name: string;
  /** 发车时刻 HH:mm，空串表示没填 */
  depart: string;
  lng: number;
  lat: number;
}

export interface ShuttleLineView {
  code: string;
  name: string;
  driver: string;
  phone: string;
  plate: string;
  /** 到公司（工厂）时刻 */
  arrive: string;
  active: boolean;
  stops: ShuttleStopView[];
}

interface LineRow {
  id: number;
  uid: string;
  name: string;
  plate: string | null;
  driver: string | null;
  arrive_factory: string | null;
  active: number;
}

interface StopRow {
  line_uid: string;
  uid: string;
  seq: number;
  name: string;
  depart: string | null;
  lng: number;
  lat: number;
}

/** line.driver 里塞的是「姓名 电话」，空格分隔；没有电话就只回姓名。 */
function splitDriver(cell: string | null): { name: string; phone: string } {
  const parts = String(cell ?? "").trim().split(/\s+/).filter(Boolean);
  return { name: parts[0] ?? "", phone: parts[1] ?? "" };
}

function driverCell(driver: string, phone: string): string {
  return (driver.trim() + " " + phone.trim()).trim();
}

const LINE_COLUMNS = "id, uid, name, plate, driver, arrive_factory, active";

function lineRows(db: Db): LineRow[] {
  return db
    .prepare("select " + LINE_COLUMNS + " from line where deleted_at is null order by uid")
    .all() as LineRow[];
}

function stopRows(db: Db): StopRow[] {
  return db
    .prepare(
      "select line.uid as line_uid, stop.uid, stop.seq, stop.name, stop.depart, stop.lng, stop.lat " +
        "from stop join line on line.id = stop.line_id " +
        "where stop.deleted_at is null and line.deleted_at is null order by line.uid, stop.seq",
    )
    .all() as StopRow[];
}

function toView(line: LineRow, stops: ShuttleStopView[]): ShuttleLineView {
  const who = splitDriver(line.driver);
  return {
    code: line.uid,
    name: line.name,
    driver: who.name,
    phone: who.phone,
    plate: line.plate ?? "",
    arrive: line.arrive_factory ?? "",
    active: Number(line.active) === 1,
    stops,
  };
}

function fromDb(db: Db): ShuttleLineView[] {
  const lines = lineRows(db);
  if (lines.length === 0) return [];
  const grouped = new Map<string, ShuttleStopView[]>();
  for (const row of stopRows(db)) {
    const list = grouped.get(row.line_uid) ?? [];
    list.push({
      uid: row.uid,
      seq: Number(row.seq),
      name: row.name,
      depart: row.depart ?? "",
      lng: Number(row.lng),
      lat: Number(row.lat),
    });
    grouped.set(row.line_uid, list);
  }
  return lines.map((line) => toView(line, grouped.get(line.uid) ?? []));
}

/** 库里还没 seed 时的兜底：直接照抄 core 的快照，保证首屏不会空。 */
function fromCore(): ShuttleLineView[] {
  return SHUTTLE_ROUTES.map((route) => ({
    code: route.code,
    name: route.name,
    driver: route.driver,
    phone: route.phone,
    plate: route.plate,
    arrive: route.arrive,
    active: true,
    stops: route.stops.map((stop: ShuttleRouteStop) => ({
      uid: route.code + "-" + stop.seq,
      seq: stop.seq,
      name: stop.name,
      depart: stop.depart,
      lng: stop.lng,
      lat: stop.lat,
    })),
  }));
}

function firstIssue(result: { error?: { issues?: { message: string }[] } }): string {
  return result.error?.issues?.[0]?.message ?? "参数不合法";
}

export function shuttleRoutes(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);
  const now = (): string => new Date().toISOString();

  const findLine = (code: string): LineRow | undefined =>
    db
      .prepare("select " + LINE_COLUMNS + " from line where uid = ? and deleted_at is null")
      .get(code) as LineRow | undefined;

  /** 单个线路的最新视图；找不到返回 null。 */
  const lineView = (code: string): ShuttleLineView | null => {
    const line = findLine(code);
    if (!line) return null;
    const stops = stopRows(db)
      .filter((row) => row.line_uid === line.uid)
      .map((row) => ({
        uid: row.uid,
        seq: Number(row.seq),
        name: row.name,
        depart: row.depart ?? "",
        lng: Number(row.lng),
        lat: Number(row.lat),
      }));
    return toView(line, stops);
  };

  /** 整份线路库；库空回退 core 快照。 */
  const library = (): { terminal: typeof SHUTTLE_TERMINAL; lines: ShuttleLineView[]; stopCount: number } => {
    const rows = fromDb(db);
    const lines = rows.length > 0 ? rows : fromCore();
    return {
      terminal: SHUTTLE_TERMINAL,
      lines,
      stopCount: lines.reduce((sum, line) => sum + line.stops.length, 0),
    };
  };

  app.get(ApiRoutes.shuttleLines, auth, (c) => c.json(library()));

  /** 新增线路：线路号重复（没被删的）直接 409；软删过的同号线路则复活改写。 */
  app.post(ApiRoutes.shuttleLines, auth, async (c) => {
    const parsed = schema.shuttleLineInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "bad_request", message: firstIssue(parsed) }, 400);
    const input = parsed.data;
    if (findLine(input.code)) {
      return c.json({ code: "duplicate", message: "线路号 " + input.code + " 已经存在" }, 409);
    }
    const at = now();
    const rev = nextRev(db);
    const cell = driverCell(input.driver, input.phone);
    const existing = db.prepare("select id from line where uid = ?").get(input.code) as { id: number } | undefined;
    if (existing) {
      db.prepare(
        "update line set name = ?, plate = ?, driver = ?, arrive_factory = ?, active = ?, deleted_at = null, rev = ?, updated_at = ? where id = ?",
      ).run(input.name, input.plate, cell, input.arrive, input.active ? 1 : 0, rev, at, existing.id);
    } else {
      db.prepare(
        "insert into line (uid, name, plate, driver, arrive_factory, direction, active, rev, updated_at) " +
          "values (?, ?, ?, ?, ?, 'am', ?, ?, ?)",
      ).run(input.code, input.name, input.plate, cell, input.arrive, input.active ? 1 : 0, rev, at);
    }
    return c.json(lineView(input.code), 201);
  });

  /** 改线路字段：只认请求里出现的键（partial 会把没传的补默认值）。 */
  app.patch(ApiRoutes.shuttleLine, auth, async (c) => {
    const code = c.req.param("code").trim().toUpperCase();
    const row = findLine(code);
    if (!row) return c.json({ code: "not_found", message: "线路不存在" }, 404);

    const raw = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return c.json({ code: "bad_request", message: "请求体不是对象" }, 400);

    const who = splitDriver(row.driver);
    const merged = {
      name: "name" in raw ? raw.name : row.name,
      driver: "driver" in raw ? raw.driver : who.name,
      phone: "phone" in raw ? raw.phone : who.phone,
      plate: "plate" in raw ? raw.plate : (row.plate ?? ""),
      arrive: "arrive" in raw ? raw.arrive : (row.arrive_factory ?? ""),
      active: "active" in raw ? raw.active : Number(row.active) === 1,
    };
    const parsed = schema.shuttleLineInputSchema.omit({ code: true }).safeParse(merged);
    if (!parsed.success) return c.json({ code: "bad_request", message: firstIssue(parsed) }, 400);
    const input = parsed.data;

    db.prepare(
      "update line set name = ?, plate = ?, driver = ?, arrive_factory = ?, active = ?, rev = ?, updated_at = ? where id = ?",
    ).run(
      input.name,
      input.plate,
      driverCell(input.driver, input.phone),
      input.arrive,
      input.active ? 1 : 0,
      nextRev(db),
      now(),
      row.id,
    );
    return c.json(lineView(code));
  });

  /** 删线路：连它的站点一起软删（历史巡检数据还能按 id 找到）。 */
  app.delete(ApiRoutes.shuttleLine, auth, (c) => {
    const code = c.req.param("code").trim().toUpperCase();
    const row = findLine(code);
    if (!row) return c.json({ code: "not_found", message: "线路不存在" }, 404);
    const at = now();
    const rev = nextRev(db);
    db.prepare("update stop set deleted_at = ?, rev = ?, updated_at = ? where line_id = ? and deleted_at is null").run(
      at,
      rev,
      at,
      row.id,
    );
    db.prepare("update line set deleted_at = ?, rev = ?, updated_at = ? where id = ?").run(at, rev, at, row.id);
    // 线路没了，通勤档案里「这条线挂在哪处公司」的记录也就没有意义，一并清掉
    unbindShuttle(db, code);
    return c.json({ ok: true, code, lines: library().lines.length });
  });

  /**
   * 整条替换站点：增删、拖顺序都走这一个口子。
   * seq 按提交顺序重排 1..n，uid 同步成「线路号-新序号」；旧的多余站点软删。
   */
  app.put(ApiRoutes.shuttleStops, auth, async (c) => {
    const code = c.req.param("code").trim().toUpperCase();
    const row = findLine(code);
    if (!row) return c.json({ code: "not_found", message: "线路不存在" }, 404);

    const parsed = schema.shuttleStopsInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "bad_request", message: firstIssue(parsed) }, 400);
    const stops = parsed.data.stops;

    const at = now();
    const rev = nextRev(db);
    db.prepare("update stop set deleted_at = ?, rev = ?, updated_at = ? where line_id = ? and deleted_at is null").run(
      at,
      rev,
      at,
      row.id,
    );

    const selectStop = db.prepare("select id from stop where uid = ?");
    const insertStop = db.prepare(
      "insert into stop (uid, line_id, seq, name, lng, lat, depart, coord_source, rev, updated_at) " +
        "values (?, ?, ?, ?, ?, ?, ?, 'listed', ?, ?)",
    );
    const reviveStop = db.prepare(
      "update stop set line_id = ?, seq = ?, name = ?, lng = ?, lat = ?, depart = ?, coord_source = 'listed', deleted_at = null, rev = ?, updated_at = ? where id = ?",
    );

    stops.forEach((stop, index) => {
      const seq = index + 1;
      const uid = code + "-" + seq;
      const found = selectStop.get(uid) as { id: number } | undefined;
      if (found) {
        reviveStop.run(row.id, seq, stop.name, stop.lng, stop.lat, stop.depart, rev, at, found.id);
      } else {
        insertStop.run(uid, row.id, seq, stop.name, stop.lng, stop.lat, stop.depart, rev, at);
      }
    });

    return c.json(lineView(code));
  });

  return app;
}
