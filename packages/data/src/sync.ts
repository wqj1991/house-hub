import type { SyncReport } from "@house/core";
import { SYNC_TABLES } from "@house/protocol";
import type { HouseRepo } from "./repo";
import { outbox } from "./outbox";
import { pull, push } from "./remote";

/**
 * 同步循环（ARCHITECTURE §6.4）。触发点：启动、每 60s、窗口聚焦、
 * 写操作后 debounce 5s、网络恢复事件。
 *
 * 注意：本地落库（applyPage）依赖 LocalRepo 的 apply_sync_page 命令，
 * 属于 P2 的 Tauri 侧工作；当前骨架只把游标推进与 push 跑通。
 */
export class SyncEngine {
  constructor(private readonly repo: HouseRepo) {}

  async tick(): Promise<SyncReport> {
    void this.repo;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { pushed: 0, pulled: 0, conflicts: 0, rev: getRev(), ok: false, error: "offline" };
    }

    const pending = await outbox.peekAll(200);
    let pushed = 0;
    let conflicts = 0;

    if (pending.length > 0) {
      const res = await push({
        deviceId: deviceId(),
        items: pending.map((p) => ({
          table: p.table,
          uid: p.uid,
          op: p.op,
          fields: p.fields,
          baseRev: p.baseRev,
          clientTs: p.clientTs,
        })),
      });
      pushed = res.applied.length;
      conflicts = res.conflicts.length;
      await outbox.ack(res.applied.map((a) => a.uid));
      await outbox.ack(res.conflicts.map((c) => c.uid)); // 服务器说谁赢就落谁，随后 pull 覆盖
      setRev(res.rev);
    }

    let since = getRev();
    let pulled = 0;
    for (;;) {
      const page = await pull(since, [...SYNC_TABLES]);
      // TODO(P2): local.applyPage(page) —— 单事务 upsert + 墓碑。
      pulled += Object.values(page.rows).reduce((n, rows) => n + (rows?.length ?? 0), 0);
      since = page.rev;
      setRev(since);
      if (!page.more) break;
    }

    return { pushed, pulled, conflicts, rev: since, ok: true };
  }
}

const REV_KEY = "house.sync.rev";
const DEVICE_KEY = "house.deviceId";

export function getRev(): number {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(REV_KEY) ?? 0);
}

export function setRev(rev: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REV_KEY, String(rev));
}

export function deviceId(): string {
  if (typeof localStorage === "undefined") return "dev_unknown";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
