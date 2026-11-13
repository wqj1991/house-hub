import type { CheckKind } from "../domain/shortlist";

/** 清单文案。改文案不用迁库：库里只存 kind + item_key + 勾选状态。 */
export interface CheckDef {
  kind: CheckKind;
  itemKey: string;
  text: string;
  group?: string;
}

/**
 * TODO(P4): 从 D:\repos\house\src\lib\checks.ts 迁入全部条目
 * （红线 20 / 尽调 9 / 看房 12 / 必问 12 / 合同 10 / 流程 10）。
 * 骨架先给出结构与首条样例，搬迁时按原文件整体替换。
 */
export const CHECK_DEFS: CheckDef[] = [
  { kind: "redline", itemKey: "R01", text: "产权不清 / 有抵押未解押", group: "产权" },
];
