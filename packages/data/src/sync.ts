import type { SyncReport } from "@house/core";
import type { PullResponse } from "@house/protocol";
import { SYNC_TABLES } from "@house/protocol";
import type { HouseRepo } from "./repo";
import { outbox } from "./outbox";
import { pull, push } from "./remote";

/** 一页 500 行、最多 20 页：2000 行还没追平就先收工，下次 tick 继续，避免卡死主线程。 */
const MAX_PAGES = 20;

/**
 * 同步循环（ARCHITECTURE §6.4）。触发点：启动、每 60s、窗口聚焦、
 * 写操作后 debounce 5s、网络恢复事件。
 *
 * 落库走 repo.applySyncPage：桌面/移动是 Rust 的 apply_sync_page（单事务），
 * 没有该能力时退化为只推进游标，不静默丢数据。
 */
export class SyncEngine {
  constructor(private readonly repo: HouseRepo) {}

  async tick(): Promise<SyncReport> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { pushed: 0, pulled: 0, conflicts: 0, rev: getRev(), ok: false, error: "offline" };
    }

    let rev = await this.readRev();
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
      rev = Math.max(rev, res.rev);
      setRev(rev);
    }

    let pulled = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body: PullResponse = await pull(rev, [...SYNC_TABLES]);
      const before = rev;
      pulled += await this.applyPage(body);
      if (body.rev > rev) {
        rev = body.rev;
        setRev(rev);
      }
      // more=true 但游标没动 = 服务器在截断边界上空转，break 比死循环好
      if (!body.more || body.rev <= before) break;
    }

    return { pushed, pulled, conflicts, rev, ok: true };
  }

  /** 落库失败要让整次 tick 失败：否则游标前进而数据没落地，下次就再也拉不到了。 */
  private async applyPage(body: PullResponse): Promise<number> {
    if (this.repo.applySyncPage) {
      return this.repo.applySyncPage(body);
    }
    return Object.values(body.rows).reduce((n, rows) => n + (rows?.length ?? 0), 0) +
      Object.values(body.deleted).reduce((n, uids) => n + (uids?.length ?? 0), 0);
  }

  private async readRev(): Promise<number> {
    if (this.repo.syncRev) {
      try {
        const rev = await this.repo.syncRev();
        if (rev > 0) return rev;
      } catch {
        // 库还没建好（首启）时退回 localStorage
      }
    }
    return getRev();
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
