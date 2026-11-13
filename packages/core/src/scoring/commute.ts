import type { CommuteMode } from "../domain/person";

/** 一条腿：一种通勤方式从小区到锚点的耗时构成。 */
export interface CommuteLeg {
  mode: CommuteMode;
  minutes: number;
  leaveHome: string | null;
  transferMin: number | null;
  rideMin: number | null;
  walkM: number | null;
  lineText: string | null;
}

/**
 * 通勤折线：按锚点把多条腿合成「几点出门 → 几点到」。
 * TODO(P4): 从 D:\repos\house\src\lib\quality.ts 与 Commute.tsx 中的折线逻辑迁入。
 */
export function commuteSeries(legs: CommuteLeg[], beIn: string | null): { minute: number; label: string }[] {
  void legs;
  void beIn;
  return [];
}
