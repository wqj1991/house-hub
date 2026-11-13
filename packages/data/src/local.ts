import type {
  CheckRow,
  Community,
  DbStatus,
  House,
  HouseDetail,
  HouseInput,
  QualityRow,
  RuleSet,
  ShuttleLine,
  SyncReport,
} from "@house/core";
import type { PullResponse } from "@house/protocol";
import type { HouseRepo } from "./repo";
import { SyncEngine } from "./sync";

/**
 * 桌面 / 移动：走 Tauri IPC 读本地 SQLite。
 * 与 D:\repos\house\src\db.ts 的 19 个命令逐条对应。
 */
type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invoke: InvokeFn | null = null;

/** 必须动态 import：否则 Web 构建产物里也会塞进 Tauri 的 IPC 实现（ARCHITECTURE §5）。 */
async function ipc<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!invoke) {
    const mod = await import("@tauri-apps/api/core");
    invoke = mod.invoke as InvokeFn;
  }
  return invoke<T>(cmd, args);
}

export class LocalRepo implements HouseRepo {
  status(): Promise<DbStatus> {
    return ipc<DbStatus>("db_status");
  }

  searchCommunities(q: string, limit = 50): Promise<Community[]> {
    return ipc<Community[]>("search_communities", { q, limit });
  }

  getCommunity(id: number): Promise<Community | null> {
    return ipc<Community | null>("get_community", { id });
  }

  upsertCommunity(input: { name: string; district?: string }): Promise<number> {
    return ipc<number>("upsert_community", { name: input.name, district: input.district ?? null });
  }

  listShortlist(): Promise<Community[]> {
    return ipc<Community[]>("list_shortlist");
  }

  addShortlist(communityId: number, note?: string): Promise<void> {
    return ipc<void>("add_shortlist", { communityId, note: note ?? null });
  }

  removeShortlist(communityId: number): Promise<void> {
    return ipc<void>("remove_shortlist", { communityId });
  }

  listQuality(communityId: number): Promise<QualityRow[]> {
    return ipc<QualityRow[]>("list_quality", { communityId });
  }

  setQuality(
    communityId: number,
    itemKey: string,
    valueNum: number | null,
    valueText: string | null,
    source?: string,
  ): Promise<void> {
    return ipc<void>("set_quality", { communityId, itemKey, valueNum, valueText, source: source ?? null });
  }

  listChecks(): Promise<CheckRow[]> {
    return ipc<CheckRow[]>("list_checks");
  }

  setCheck(kind: string, itemKey: string, checked: boolean, note?: string): Promise<void> {
    return ipc<void>("set_check", { kind, itemKey, checked, note: note ?? null });
  }

  getSettings(): Promise<Record<string, string>> {
    return ipc<Record<string, string>>("get_settings");
  }

  putSetting(key: string, value: string): Promise<void> {
    return ipc<void>("put_setting", { key, value });
  }

  listLines(direction: "am" | "pm" = "am"): Promise<ShuttleLine[]> {
    return ipc<ShuttleLine[]>("list_lines", { direction });
  }

  listHouses(communityId: number): Promise<House[]> {
    return ipc<House[]>("list_houses", { communityId });
  }

  getHouse(id: number): Promise<HouseDetail | null> {
    return ipc<HouseDetail | null>("get_house", { id });
  }

  saveHouse(input: HouseInput): Promise<number> {
    return ipc<number>("save_house", { input });
  }

  deleteHouse(id: number): Promise<void> {
    return ipc<void>("delete_house", { id });
  }

  setHouseScore(houseId: number, itemKey: string, score: number | null): Promise<void> {
    return ipc<void>("set_house_score", { houseId, itemKey, score });
  }

  setHouseRedline(houseId: number, itemKey: string, hit: boolean): Promise<void> {
    return ipc<void>("set_house_redline", { houseId, itemKey, hit });
  }

  sync(): Promise<SyncReport> {
    return new SyncEngine(this).tick();
  }

  /** 单事务落库在 Rust 侧（apply_sync_page）：跨 16 张表的 upsert 不能半途而废。 */
  applySyncPage(page: PullResponse): Promise<number> {
    return ipc<number>("apply_sync_page", { page });
  }

  syncRev(): Promise<number> {
    return ipc<number>("sync_rev");
  }

  /** score_rule 全集与 hash 由 Rust 侧算（list_rules），页面据此判断是否在校旧分。 */
  rules(): Promise<RuleSet> {
    return ipc<RuleSet>("list_rules");
  }
}
