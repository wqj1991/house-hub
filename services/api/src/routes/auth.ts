import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiRoutes, ErrorCodes } from "@house/protocol";
import { deviceAuth, hashToken, internalAuth, newToken, sixDigitCode } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";

const pairBody = z.object({
  code: z.string().regex(/^\d{6}$/),
  deviceName: z.string().min(1).max(60),
  platform: z.enum(["desktop", "android", "web"]),
});

const CODE_TTL_MINUTES = 10;

/**
 * 配对：老设备出一个 6 位码，新设备带着码换 token。
 * 出码口是 /internal/pair/code，只给本机（SSH 或 systemd 运维）用。
 */
export function authRoutes(db: Db, internalToken: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post("/internal/pair/code", internalAuth(internalToken), (c) => {
    const code = sixDigitCode();
    db.prepare(
      "insert into pairing_code (code, expires_at) values (?, datetime('now', '+" + CODE_TTL_MINUTES + " minutes'))",
    ).run(code);
    return c.json({ code, expiresInMinutes: CODE_TTL_MINUTES });
  });

  app.post(ApiRoutes.authPair, async (c) => {
    const body = pairBody.parse(await c.req.json());
    const row = db
      .prepare("select code, used_at from pairing_code where code = ? and expires_at > datetime('now')")
      .get(body.code) as { code: string; used_at: string | null } | undefined;
    if (!row || row.used_at) {
      return c.json({ code: ErrorCodes.unauthorized, message: "配对码无效或已过期" }, 401);
    }

    const token = newToken();
    const deviceId = "dev_" + randomUUID().replace(/-/g, "").slice(0, 16);
    db.transaction(() => {
      db.prepare("update pairing_code set used_at = datetime('now') where code = ?").run(body.code);
      db.prepare("insert into device (id, name, platform, token_hash) values (?, ?, ?, ?)").run(
        deviceId,
        body.deviceName,
        body.platform,
        hashToken(token),
      );
    })();

    return c.json({ deviceId, token, platform: body.platform });
  });

  app.post(ApiRoutes.authRefresh, deviceAuth(db), (c) => {
    const device = c.get("device");
    const token = newToken();
    db.prepare("update device set token_hash = ?, last_seen = datetime('now') where id = ?").run(
      hashToken(token),
      device.id,
    );
    return c.json({ deviceId: device.id, token });
  });

  app.post(ApiRoutes.authRevoke, deviceAuth(db), (c) => {
    const device = c.get("device");
    db.prepare("update device set revoked = 1 where id = ?").run(device.id);
    return c.json({ revoked: true, deviceId: device.id });
  });

  return app;
}
