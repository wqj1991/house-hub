import type { JifenRow } from "../domain/person";

export const JIFEN_ITEMS = [
  "社保",
  "个税",
  "年龄",
  "学历",
  "职称",
  "户籍",
  "婚姻",
  "住房",
  "其他",
] as const;

export type JifenItem = (typeof JIFEN_ITEMS)[number];

/**
 * 积分九项按人按年合计。
 * TODO(P4): 从 D:\repos\house\src\lib\quality.ts / Jifen 相关页面迁入真实口径。
 * ADR-0001：积分不进排序，只做展示。
 */
export function jifenTotal(rows: JifenRow[], personUid: string, year: number): number | null {
  const picked = rows.filter((r) => r.personUid === personUid && r.year === year);
  if (picked.length === 0) return null;
  return picked.reduce((sum, r) => sum + (r.value ?? 0), 0);
}
