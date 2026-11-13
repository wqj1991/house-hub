import { Hono } from "hono";
import { ApiRoutes, ErrorCodes } from "@house/protocol";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import { communityDto } from "../wire";

const MAX_LIMIT = 200;

export function communityRoutes(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);

  app.get(ApiRoutes.communities, auth, (c) => {
    const q = (c.req.query("q") ?? "").trim();
    const district = (c.req.query("district") ?? "").trim();
    const raw = Number(c.req.query("limit") ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(raw) ? Math.trunc(raw) : 50, 1), MAX_LIMIT);
    const like = "%" + q + "%";

    const rows = db
      .prepare(
        "select * from community where deleted_at is null" +
          " and (? = '' or name like ? or ifnull(bizcircle,'') like ? or ifnull(address,'') like ?)" +
          " and (? = '' or district = ?)" +
          " order by ifnull(tx_n,0) desc, name collate nocase limit ?",
      )
      .all(q, like, like, like, district, district, limit) as Record<string, unknown>[];

    return c.json(rows.map(communityDto));
  });

  app.get(ApiRoutes.community, auth, (c) => {
    const uid = c.req.param("uid");
    const row = db
      .prepare("select * from community where (uid = ? or cast(id as text) = ?) and deleted_at is null")
      .get(uid, uid);
    if (!row) return c.json({ code: ErrorCodes.notFound, message: "小区不存在" }, 404);
    return c.json(communityDto(row as Record<string, unknown>));
  });

  app.get(ApiRoutes.transactions, auth, (c) => {
    const uid = c.req.param("uid");
    // 成交明细不进同步（ARCHITECTURE §6.6）；P3 抓到明细后再建这张表
    return c.json({ uid, items: [], note: "P3 之后才有成交明细" });
  });

  return app;
}
