import { createHash } from "node:crypto";
import { Hono } from "hono";
import { ApiRoutes } from "@house/protocol";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";

interface RuleRowWire {
  id: number;
  scope: string;
  itemKey: string;
  weight: number;
  formula: string | null;
  note: string | null;
  updatedAt: string;
}

/** 没有 rule_set 行时用行内容算 hash，保证客户端两次拉取一致。 */
function hashRows(rows: RuleRowWire[]): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
}

export function ruleRoutes(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);

  app.get(ApiRoutes.rules, auth, (c) => {
    const rows = db
      .prepare(
        "select id, scope, item_key, weight, formula, note, updated_at from score_rule" +
          " where deleted_at is null order by scope, item_key",
      )
      .all() as { id: number; scope: string; item_key: string; weight: number; formula: string | null; note: string | null; updated_at: string }[];

    const wire: RuleRowWire[] = rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      itemKey: r.item_key,
      weight: r.weight,
      formula: r.formula,
      note: r.note,
      updatedAt: r.updated_at,
    }));

    const set = db
      .prepare("select version, hash, min_client_version from rule_set order by version desc limit 1")
      .get() as { version: number; hash: string; min_client_version: string | null } | undefined;

    return c.json({
      version: set?.version ?? 0,
      hash: set?.hash ?? hashRows(wire),
      minClientVersion: set?.min_client_version ?? null,
      rows: wire,
    });
  });

  return app;
}
