import type { SyncTable } from "@house/protocol";

/** 本地画面对「库在哪、多大、多少行」的唯一描述。 */
export interface DbStatus {
  path: string;
  communities: number;
  persons: number;
  lines: number;
  stops: number;
  routes: number;
  /** 上次同步到的服务器 rev；未同步过为 0 */
  rev: number;
  version: string;
}

/** 一次 tick() 的结果，直接喂给「待同步 N 条」那条提示。 */
export interface SyncReport {
  pushed: number;
  pulled: number;
  conflicts: number;
  rev: number;
  /** 无网络 / 无令牌时为 false */
  ok: boolean;
  error?: string;
}

export interface RuleRow {
  id: number;
  scope: "quality" | "commute" | "gating";
  itemKey: string;
  weight: number;
  formula: string | null;
  note: string | null;
  updatedAt: string;
}

/** /rules 的完整返回：hash 不匹配说明客户端在校旧分（ARCHITECTURE §13）。 */
export interface RuleSet {
  version: number;
  hash: string;
  minClientVersion: string | null;
  rows: RuleRow[];
}

export type { SyncTable };
