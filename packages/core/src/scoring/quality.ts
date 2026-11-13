import type { QualityRow } from "../domain/community";

/**
 * 品质分项 → 1–5 分。
 * TODO(P4): 从 D:\repos\house\src\lib\quality.ts 原样迁入；规则由 score_rule 下发，
 * 这里只做「原始值 → 分」的映射，worker 不决定分数（ADR-0004）。
 */
export function scoreQualityItem(itemKey: string, row: Pick<QualityRow, "valueNum" | "valueText">): number | null {
  void itemKey;
  void row;
  return null;
}
