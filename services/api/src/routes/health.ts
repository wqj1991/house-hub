import { Hono } from "hono";
import { ApiRoutes } from "@house/protocol";
import { currentRev } from "../db";
import type { Db } from "../db";

/** 唯一不需要令牌的接口：部署脚本与 RemoteRepo.status() 都靠它。 */
export function healthRoutes(db: Db, version: string): Hono {
  const app = new Hono();

  app.get(ApiRoutes.health, (c) => {
    const row = db.prepare("select count(*) as n from community where deleted_at is null").get() as { n: number };
    return c.json({
      ok: true,
      version,
      rev: currentRev(db),
      communities: Number(row.n),
      now: new Date().toISOString(),
    });
  });

  return app;
}
