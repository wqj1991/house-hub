import type { PullResponse } from "@house/protocol";
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

/**
 * 页面唯一认得的东西（ARCHITECTURE §5）。
 * 签名与 D:\repos\house\src\db.ts 现有 19 个命令一一对应；新增只有 sync 与 rules。
 * P0 阶段可以用薄转出层让页面 0 改动，见 @/db 的迁移说明。
 */
export interface HouseRepo {
  status(): Promise<DbStatus>;

  searchCommunities(q: string, limit?: number): Promise<Community[]>;
  getCommunity(id: number): Promise<Community | null>;
  upsertCommunity(input: { name: string; district?: string }): Promise<number>;

  listShortlist(): Promise<Community[]>;
  addShortlist(communityId: number, note?: string): Promise<void>;
  removeShortlist(communityId: number): Promise<void>;

  listQuality(communityId: number): Promise<QualityRow[]>;
  setQuality(
    communityId: number,
    itemKey: string,
    valueNum: number | null,
    valueText: string | null,
    source?: string,
  ): Promise<void>;

  listChecks(): Promise<CheckRow[]>;
  setCheck(kind: string, itemKey: string, checked: boolean, note?: string): Promise<void>;

  getSettings(): Promise<Record<string, string>>;
  putSetting(key: string, value: string): Promise<void>;

  listLines(direction?: "am" | "pm"): Promise<ShuttleLine[]>;

  listHouses(communityId: number): Promise<House[]>;
  getHouse(id: number): Promise<HouseDetail | null>;
  saveHouse(h: HouseInput): Promise<number>;
  deleteHouse(id: number): Promise<void>;
  setHouseScore(houseId: number, itemKey: string, score: number | null): Promise<void>;
  setHouseRedline(houseId: number, itemKey: string, hit: boolean): Promise<void>;

  /** Local: 推 outbox + 拉增量；Remote: 推 outbox（只读数据靠 fetch 直取）。 */
  sync(): Promise<SyncReport>;
  /** 本地落库：单事务 upsert + 墓碑，返回写入行数。只有 Local 端实现。 */
  applySyncPage?(page: PullResponse): Promise<number>;
  /** 本地同步游标（sync_meta.rev）。Local 端以它为准，localStorage 只是兜底。 */
  syncRev?(): Promise<number>;
  /** score_rule 全集 + version + hash；hash 不匹配时页面黄条公示，不静默出旧分。 */
  rules(): Promise<RuleSet>;
}

export type { House, HouseInput, HouseDetail, Community, QualityRow, CheckRow, ShuttleLine, DbStatus, SyncReport, RuleSet };
