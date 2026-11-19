import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Db } from "./db";

/**
 * 账号密码：scrypt 派生，格式 scrypt$<salt hex>$<hash hex>。
 * 只存派生值，明文密码不出现在库里、日志里、响应里。
 */
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "hex");
  if (want.length !== KEYLEN) return false;
  const got = scryptSync(password, salt, KEYLEN);
  return timingSafeEqual(got, want);
}

export type Account = { id: string; username: string; pass_hash: string };

export function findAccount(db: Db, username: string): Account | undefined {
  return db.prepare("select id, username, pass_hash from account where username = ?").get(username) as
    | Account
    | undefined;
}

/** 卡片头部要的三样：名字、建号时间、头像。头像允许空（空就退回首字母）。 */
export type AccountProfileRow = { username: string; created_at: string; avatar: string | null };

export function findAccountProfile(db: Db, id: string): AccountProfileRow | undefined {
  return db.prepare("select username, created_at, avatar from account where id = ?").get(id) as
    | AccountProfileRow
    | undefined;
}

/** 头像只写这一列，改个图不动 updated_at 之外的东西。 */
export function setAccountAvatar(db: Db, id: string, avatar: string | null): void {
  db.prepare("update account set avatar = ?, updated_at = datetime('now') where id = ?").run(avatar, id);
}

/**
 * 默认账号：库里没有这个用户名就建一条（已存在则不动，改密码不会被启动覆盖）。
 * 账号密码来自 HOUSE_ADMIN_USER / HOUSE_ADMIN_PASS，没配就用仓库约定的默认值。
 */
export function ensureDefaultAccount(db: Db, username: string, password: string): { created: boolean; username: string } {
  const name = username.trim();
  if (!name || !password) return { created: false, username: name };
  const exists = findAccount(db, name);
  if (exists) return { created: false, username: name };
  db.prepare("insert into account (id, username, pass_hash) values (?, ?, ?)").run(
    "usr_" + randomUUID().replace(/-/g, "").slice(0, 16),
    name,
    hashPassword(password),
  );
  return { created: true, username: name };
}
