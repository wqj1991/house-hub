import type { House, HouseInput } from "../domain/house";

/**
 * 房屋打分卡 A1–A25 → 加权分。
 * TODO(P4): 从 D:\repos\house\src\lib\house.ts 迁入；权重来自 score_rule(scope='quality')。
 */
export function scoreHouse(
  input: HouseInput,
  scores: Record<string, number>,
): { total: number; byItem: Record<string, number> } | null {
  void input;
  void scores;
  return null;
}

/** 红线命中即一票否决：返回命中的 item_key 列表。 */
export function hitRedlines(redlines: string[]): string[] {
  return redlines;
}

export type { House };
