import { Hono } from "hono";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiRoutes, ErrorCodes } from "@house/protocol";
import { deviceAuth, hashToken, internalAuth, newToken, sixDigitCode } from "../auth";
import { findAccount, findAccountProfile, setAccountAvatar, verifyPassword } from "../account";
import type { AppEnv } from "../auth";
import type { Db } from "../db";

const pairBody = z
  .object({
    code: z.string().regex(/^\d{6}$/).optional(),
    key: z.string().min(16).max(200).optional(),
    deviceName: z.string().min(1).max(60),
    platform: z.enum(["desktop", "android", "web"]),
  })
  .refine((body) => Boolean(body.key || body.code), { message: "要么给配对码，要么给配对密钥" });

/** 账号密码登录：进应用的第一道门，过了才发设备令牌。 */
const loginBody = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
  deviceName: z.string().min(1).max(60),
  platform: z.enum(["desktop", "android", "web"]),
});

/** 头像：一张 256×256 的 jpeg data URL，前端已经压过，这里只挡掉非图片和超大串。 */
const avatarBody = z.object({
  avatar: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
});

const CODE_TTL_MINUTES = 10;

/** 连续试错刹车：同一账号 15 分钟内错 5 次锁到窗口结束，避免有人拿字典慢慢磨。 */
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LIMIT = 5;
const failures = new Map<string, { count: number; firstAt: number }>();

function failState(username: string): { locked: boolean; remainSec: number } {
  const row = failures.get(username);
  if (!row) return { locked: false, remainSec: 0 };
  const age = Date.now() - row.firstAt;
  if (age > FAIL_WINDOW_MS) {
    failures.delete(username);
    return { locked: false, remainSec: 0 };
  }
  return { locked: row.count >= FAIL_LIMIT, remainSec: Math.ceil((FAIL_WINDOW_MS - age) / 1000) };
}

function noteFailure(username: string): void {
  const row = failures.get(username);
  if (!row || Date.now() - row.firstAt > FAIL_WINDOW_MS) {
    failures.set(username, { count: 1, firstAt: Date.now() });
    return;
  }
  row.count += 1;
}

/** 定时安全比较：长度不同直接判否，长度相同才走 timingSafeEqual。 */
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * 配对：两条路——
 *   ① 6 位码：/internal/pair/code 现出，10 分钟、一次有效（服务器本机才能出码）；
 *   ② 长期配对密钥：服务器 env HOUSE_PAIR_KEY，手机把它粘贴进「配对码」一栏即可，不用再出码。
 */
export function authRoutes(db: Db, internalToken: string, pairKey = "", adminUser = ""): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post("/internal/pair/code", internalAuth(internalToken), (c) => {
    const code = sixDigitCode();
    db.prepare(
      "insert into pairing_code (code, expires_at) values (?, datetime('now', '+" + CODE_TTL_MINUTES + " minutes'))",
    ).run(code);
    return c.json({ code, expiresInMinutes: CODE_TTL_MINUTES });
  });

  app.post(ApiRoutes.authLogin, async (c) => {
    const body = loginBody.parse(await c.req.json());
    const username = body.username.trim();

    const guard = failState(username);
    if (guard.locked) {
      return c.json({ code: ErrorCodes.unauthorized, message: "错太多次了，" + Math.ceil(guard.remainSec / 60) + " 分钟后再试" }, 429);
    }

    const account = findAccount(db, username);
    if (!account || !verifyPassword(body.password, account.pass_hash)) {
      noteFailure(username);
      return c.json({ code: ErrorCodes.unauthorized, message: "账号或密码不对" }, 401);
    }

    failures.delete(username);
    const token = newToken();
    const deviceId = "dev_" + randomUUID().replace(/-/g, "").slice(0, 16);
    db.prepare("insert into device (id, name, platform, token_hash, account_id) values (?, ?, ?, ?, ?)").run(
      deviceId,
      body.deviceName,
      body.platform,
      hashToken(token),
      account.id,
    );
    db.prepare("update account set updated_at = datetime('now') where id = ?").run(account.id);
    return c.json({ deviceId, token, platform: body.platform, username: account.username });
  });

  /** 这枚令牌是谁：界面上「我的」那块用户信息照着它显示，换账号登录自然就换人。 */
  app.get(ApiRoutes.authMe, deviceAuth(db), (c) => {
    const device = c.get("device");
    const row = device.accountId ? findAccountProfile(db, device.accountId) : undefined;
    const username = row?.username ?? "";
    return c.json({
      username,
      role: username && username === adminUser ? "admin" : "member",
      accountId: device.accountId,
      createdAt: row?.created_at ?? null,
      avatar: row?.avatar ?? null,
      deviceId: device.id,
      deviceName: device.name,
      platform: device.platform,
    });
  });

  /** 换头像：传 null 就等于恢复成首字母。只改自己账号那一行。 */
  app.post(ApiRoutes.accountAvatar, deviceAuth(db), async (c) => {
    const device = c.get("device");
    if (!device.accountId) {
      return c.json({ code: ErrorCodes.unauthorized, message: "这枚令牌没绑账号，重新登录一次" }, 401);
    }
    const body = avatarBody.parse(await c.req.json());
    setAccountAvatar(db, device.accountId, body.avatar);
    return c.json({ avatar: body.avatar });
  });

  app.post(ApiRoutes.authPair, async (c) => {
    const body = pairBody.parse(await c.req.json());

    if (body.key) {
      if (!pairKey) {
        return c.json({ code: ErrorCodes.unauthorized, message: "服务器没有配置配对密钥（HOUSE_PAIR_KEY）" }, 401);
      }
      if (!sameSecret(body.key, pairKey)) {
        return c.json({ code: ErrorCodes.unauthorized, message: "配对密钥不对" }, 401);
      }
      const token = newToken();
      const deviceId = "dev_" + randomUUID().replace(/-/g, "").slice(0, 16);
      db.prepare("insert into device (id, name, platform, token_hash) values (?, ?, ?, ?)").run(
        deviceId,
        body.deviceName,
        body.platform,
        hashToken(token),
      );
      return c.json({ deviceId, token, platform: body.platform });
    }

    const code = body.code as string;
    const row = db
      .prepare("select code, used_at from pairing_code where code = ? and expires_at > datetime('now')")
      .get(code) as { code: string; used_at: string | null } | undefined;
    if (!row || row.used_at) {
      return c.json({ code: ErrorCodes.unauthorized, message: "配对码无效或已过期" }, 401);
    }

    const token = newToken();
    const deviceId = "dev_" + randomUUID().replace(/-/g, "").slice(0, 16);
    db.transaction(() => {
      db.prepare("update pairing_code set used_at = datetime('now') where code = ?").run(code);
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
