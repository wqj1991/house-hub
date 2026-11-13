import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "../db";

/**
 * 手写 SQL 迁移：启动时看 pragma user_version，按文件名顺序补跑。
 * 任何一步失败就抛错拒绝启动，不留半迁移状态（ARCHITECTURE §8）。
 */
const DIR = fileURLToPath(new URL(".", import.meta.url));

export function runMigrations(db: Db): number {
  const files = readdirSync(DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();

  const current = Number(db.pragma("user_version", { simple: true }));
  if (current > files.length) {
    throw new Error("数据库版本 " + current + " 比代码里的迁移(" + files.length + ")新，拒绝启动");
  }

  for (let i = current; i < files.length; i++) {
    const name = files[i] as string;
    const sql = readFileSync(join(DIR, name), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.pragma("user_version = " + (i + 1));
    })();
  }

  return Number(db.pragma("user_version", { simple: true }));
}
