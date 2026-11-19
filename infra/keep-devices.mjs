#!/usr/bin/env node
/**
 * 数据导入后把「设备行」从被覆盖的旧库搬回来。
 *
 * 起因：本机快照里的 device 表是本机那几台设备，服务器自己签发的令牌不在里面。
 * 直接覆盖整库 = 线上所有手机/桌面下一次请求全 401（表现为「服务重启后令牌换了」）。
 * 设备是「这台服务器上的会话」，跟着服务器走，不该跟着数据快照走。
 *
 *   node infra/keep-devices.mjs /var/lib/house/house.db.bak-<stamp> /var/lib/house/house.db
 *
 * 以旧库（线上为准）覆盖新库同 id 的行；token_hash 撞唯一索引的跳过，不阻断发布。
 * 只跑在停服窗口里，必须关掉连接再让发布脚本删 -wal/-shm。
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const [, , bakPath, dbPath] = process.argv;
if (!bakPath || !dbPath) {
  console.error("用法: node infra/keep-devices.mjs <旧库> <新库>");
  process.exit(2);
}
if (!fs.existsSync(bakPath)) {
  console.log("device=skip 没有旧库可比");
  process.exit(0);
}

const db = new DatabaseSync(dbPath);
db.exec("attach database '" + bakPath.replace(/'/g, "''") + "' as bak");
const hasTable = db.prepare("select 1 as ok from bak.sqlite_master where type = 'table' and name = 'device'").get();
if (!hasTable) {
  db.exec("detach bak");
  db.close();
  console.log("device=skip 旧库没有 device 表");
  process.exit(0);
}

const rows = db
  .prepare("select id, name, platform, token_hash, created_at, last_seen, revoked from bak.device")
  .all();
const keep = db.prepare(
  "insert into device (id, name, platform, token_hash, created_at, last_seen, revoked) " +
    "values (?, ?, ?, ?, ?, ?, ?) " +
    "on conflict(id) do update set token_hash = excluded.token_hash, revoked = excluded.revoked, " +
    "name = excluded.name, platform = excluded.platform, last_seen = excluded.last_seen",
);

let kept = 0;
let skipped = 0;
for (const r of rows) {
  try {
    keep.run(r.id, r.name, r.platform, r.token_hash, r.created_at, r.last_seen, r.revoked);
    kept++;
  } catch (err) {
    skipped++; // token_hash 撞唯一索引（同一令牌换过 id）：留着新的那条，发布继续
  }
}

db.exec("detach bak");
db.close();
console.log("device=kept " + kept + (skipped ? " skipped=" + skipped : ""));
