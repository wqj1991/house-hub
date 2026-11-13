import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiRoutes, ErrorCodes } from "@house/protocol";
import { deviceAuth, internalAuth } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";

const fillBody = z.object({
  communityUid: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  district: z.string().optional(),
});

const routeBody = z.object({
  personUid: z.string().min(1),
  communityUids: z.array(z.string().min(1)).max(50).optional(),
});

const finishBody = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().max(2000).optional(),
});

interface JobRow {
  id: string;
  kind: string;
  payload: string;
  status: string;
  attempts: number;
}

function enqueue(db: Db, kind: string, payload: unknown): string {
  const id = "job_" + randomUUID().replace(/-/g, "");
  db.prepare("insert into job (id, kind, payload) values (?, ?, ?)").run(id, kind, JSON.stringify(payload));
  return id;
}

/**
 * 任务：客户端只提需求（排队），worker 领活干（/internal/*），
 * 两边都不直连对方的存储（ARCHITECTURE §2 硬边界 2）。
 */
export function jobRoutes(db: Db, internalToken: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post(ApiRoutes.communityFill, deviceAuth(db), async (c) => {
    const body = fillBody.parse(await c.req.json());
    if (!body.communityUid && !body.name) {
      return c.json({ code: ErrorCodes.badRequest, message: "communityUid 或 name 至少给一个" }, 400);
    }
    const jobId = enqueue(db, "community_fill", body);
    return c.json({ jobId, status: "queued" }, 202);
  });

  app.post(ApiRoutes.routeCompute, deviceAuth(db), async (c) => {
    const body = routeBody.parse(await c.req.json());
    const jobId = enqueue(db, "route_compute", body);
    return c.json({ jobId, status: "queued" }, 202);
  });

  app.get(ApiRoutes.job, deviceAuth(db), (c) => {
    const id = c.req.param("id");
    const row = db.prepare("select id, kind, status, attempts, result, error, created_at, finished_at from job where id = ?").get(id) as
      | { id: string; kind: string; status: string; attempts: number; result: string | null; error: string | null; created_at: string; finished_at: string | null }
      | undefined;
    if (!row) return c.json({ code: ErrorCodes.notFound, message: "任务不存在" }, 404);
    return c.json({
      id: row.id,
      kind: row.kind,
      status: row.status,
      attempts: row.attempts,
      result: row.result ? (JSON.parse(row.result) as unknown) : null,
      error: row.error,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    });
  });

  // worker 只在 127.0.0.1 上被 openresty 之外的本地进程调用
  app.post(ApiRoutes.internalClaim, internalAuth(internalToken), (c) => {
    const claimed = db.transaction(() => {
      const row = db
        .prepare("select id, kind, payload, attempts from job where status = 'queued' order by created_at asc limit 1")
        .get() as JobRow | undefined;
      if (!row) return null;
      db.prepare(
        "update job set status = 'running', attempts = attempts + 1, worker = 'worker', started_at = datetime('now') where id = ?",
      ).run(row.id);
      return row;
    })();

    if (!claimed) return c.body(null, 204);
    return c.json({
      id: claimed.id,
      kind: claimed.kind,
      attempts: claimed.attempts + 1,
      payload: JSON.parse(claimed.payload) as unknown,
    });
  });

  app.post(ApiRoutes.internalFinish, internalAuth(internalToken), async (c) => {
    const id = c.req.param("id");
    const body = finishBody.parse(await c.req.json());
    const status = body.ok ? "done" : "failed";
    const changed = db
      .prepare(
        "update job set status = ?, result = ?, error = ?, finished_at = datetime('now') where id = ?",
      )
      .run(status, JSON.stringify(body.result ?? null), body.error ?? null, id).changes;
    if (!changed) return c.json({ code: ErrorCodes.notFound, message: "任务不存在" }, 404);
    return c.json({ id, status });
  });

  return app;
}
