import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations/index";

export type Db = InstanceType<typeof Database>;

/**
 * house.db 的唯一写者。单进程 + WAL + busy_timeout。
 * worker 不直连库，只走 /internal/*（ARCHITECTURE §2 硬边界 1）。
 */
export function openDb(path: string): Db {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  return db;
}

/** 全局单调 rev：拉取游标就是它（ARCHITECTURE §6.3）。 */
export function nextRev(db: Db): number {
  const row = db.prepare("select rev from sync_counter").get() as { rev: number } | undefined;
  const rev = Number(row?.rev ?? 0) + 1;
  db.prepare("update sync_counter set rev = ?").run(rev);
  return rev;
}

export function currentRev(db: Db): number {
  const row = db.prepare("select rev from sync_counter").get() as { rev: number } | undefined;
  return Number(row?.rev ?? 0);
}
