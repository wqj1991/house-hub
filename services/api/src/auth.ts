import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { ErrorCodes, INTERNAL_TOKEN_HEADER } from "@house/protocol";
import type { Db } from "./db";

export interface Device {
  id: string;
  name: string;
  platform: string;
  accountId: string | null;
}

/** 认证后 c.get("device") 的类型。 */
export type AppEnv = { Variables: { device: Device } };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

/** D3：6 位一次性配对码，只在终端上念一次。 */
export function sixDigitCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function bearer(c: Context): string | null {
  const raw = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m && m[1] ? m[1].trim() : null;
}

/** 设备令牌 → device 行；令牌无效统一 401，不区分「没见过」和「已吊销」。 */
export function deviceAuth(db: Db): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = bearer(c);
    if (!token) return c.json({ code: ErrorCodes.unauthorized, message: "缺少设备令牌" }, 401);
    const row = db
      .prepare("select id, name, platform, account_id as accountId from device where token_hash = ? and revoked = 0")
      .get(hashToken(token)) as Device | undefined;
    if (!row) return c.json({ code: ErrorCodes.unauthorized, message: "设备令牌无效" }, 401);
    db.prepare("update device set last_seen = datetime('now') where id = ?").run(row.id);
    c.set("device", row);
    await next();
  };
}

/** 内网口只认头里的共享密钥，worker 与本机运维用。 */
export function internalAuth(expected: string): MiddlewareHandler {
  return async (c, next) => {
    const got = c.req.header(INTERNAL_TOKEN_HEADER) ?? "";
    if (!safeEqual(got, expected)) {
      return c.json({ code: ErrorCodes.forbidden, message: "internal token 无效" }, 403);
    }
    await next();
  };
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
