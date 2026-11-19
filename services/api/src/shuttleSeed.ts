import { SHUTTLE_ROUTES, SHUTTLE_STOP_TOTAL } from "@house/core";
import { nextRev } from "./db";
import type { Db } from "./db";

/**
 * 班车线路库入库：line 表一条线路、stop 表一个上客点。
 *
 * 为什么不用「用户录入表单」：这 9 条线是公司发的固定时刻表，属于事实数据，不该让手抄出错。
 * 每次启动都按 core 里的快照对齐一遍（uid 幂等），改了数据重跑一次就同步了。
 *
 * line 表没有电话列：司机与电话拼在 driver 一列，空格分隔，接口层再拆开。
 * line 表的 uid 就是线路号（Y01…），没有独立 code 列的冗余。
 */

export interface ShuttleSeedResult {
  lines: number;
  stops: number;
  /** 这次真正写了多少行；0 表示库里已经是最新的 */
  changed: number;
}

function driverCell(route: { driver: string; phone: string }): string {
  return (route.driver + " " + route.phone).trim();
}

export function ensureShuttleSeed(db: Db): ShuttleSeedResult {
  const selectLine = db.prepare("select id, name, plate, driver, arrive_factory, active from line where uid = ?");
  const selectStop = db.prepare("select id, seq, name, lng, lat, depart from stop where uid = ?");
  const insertLine = db.prepare(
    "insert into line (uid, name, plate, driver, arrive_factory, direction, active, rev, updated_at) values (?, ?, ?, ?, ?, 'am', 1, ?, ?)",
  );
  const updateLine = db.prepare(
    "update line set name = ?, plate = ?, driver = ?, arrive_factory = ?, direction = 'am', active = 1, deleted_at = null, rev = ?, updated_at = ? where uid = ?",
  );
  const insertStop = db.prepare(
    "insert into stop (uid, line_id, seq, name, lng, lat, depart, coord_source, rev, updated_at) values (?, ?, ?, ?, ?, ?, ?, 'listed', ?, ?)",
  );
  const updateStop = db.prepare(
    "update stop set line_id = ?, seq = ?, name = ?, lng = ?, lat = ?, depart = ?, coord_source = 'listed', deleted_at = null, rev = ?, updated_at = ? where uid = ?",
  );

  let changed = 0;
  let revCache: number | null = null;
  const rev = (): number => {
    if (revCache === null) revCache = nextRev(db);
    changed += 1;
    return revCache;
  };
  const now = new Date().toISOString();

  for (const route of SHUTTLE_ROUTES) {
    const driver = driverCell(route);
    const existing = selectLine.get(route.code) as
      | { id: number; name: string; plate: string | null; driver: string | null; arrive_factory: string | null; active: number }
      | undefined;

    let lineId: number;
    if (!existing) {
      const info = insertLine.run(route.code, route.name, route.plate, driver, route.arrive, rev(), now);
      lineId = Number(info.lastInsertRowid);
    } else {
      lineId = existing.id;
      const same =
        existing.name === route.name &&
        existing.plate === route.plate &&
        existing.driver === driver &&
        existing.arrive_factory === route.arrive &&
        Number(existing.active) === 1;
      if (!same) updateLine.run(route.name, route.plate, driver, route.arrive, rev(), now, route.code);
    }

    for (const stop of route.stops) {
      const uid = route.code + "-" + stop.seq;
      const found = selectStop.get(uid) as
        | { id: number; seq: number; name: string; lng: number; lat: number; depart: string | null }
        | undefined;
      if (!found) {
        insertStop.run(uid, lineId, stop.seq, stop.name, stop.lng, stop.lat, stop.depart, rev(), now);
        continue;
      }
      const same =
        found.seq === stop.seq &&
        found.name === stop.name &&
        Math.abs(found.lng - stop.lng) < 1e-6 &&
        Math.abs(found.lat - stop.lat) < 1e-6 &&
        found.depart === stop.depart;
      if (!same) updateStop.run(lineId, stop.seq, stop.name, stop.lng, stop.lat, stop.depart, rev(), now, uid);
    }
  }

  return { lines: SHUTTLE_ROUTES.length, stops: SHUTTLE_STOP_TOTAL, changed };
}
