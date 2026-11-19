import { useSyncExternalStore } from "react";
import type { ContributionState, IncomeMember, MemberRelation } from "@house/core";
import * as incomeApi from "./incomeApi";
import { bootServer, isPaired } from "./serverClient";

/**
 * 收入与公积金：数据住在服务端，这里只是它的镜像 + 请求状态。
 * 没有本地缓存、没有合并、没有离线队列 —— 每次增删改都打服务器，返回什么就是什么，两台设备天然一致。
 */

/** 组合贷测算的输入（与服务端 doc 去掉 members 后同形）。 */
export interface IncomeState {
  members: IncomeMember[];
  /** 组合贷测算的目标总价（万元） */
  dealWan: number;
  /** 首付比例，0.35 = 三成五 */
  downRatio: number;
  /** 贷款年限（年） */
  years: number;
  /** 是否二套（利率、额度上限、首付比例都变） */
  second: boolean;
  /** 家庭条件：北京户籍 / 二孩及以上（房子的条件算房贷时再填） */
  family: incomeApi.IncomeFamilyFlags;
}

export type IncomePhase = "unpaired" | "loading" | "ready" | "error";

export interface IncomeSnapshot extends IncomeState {
  /** unpaired＝没连服务器；loading＝首次读取；ready＝与服务端一致；error＝最近一次请求失败 */
  phase: IncomePhase;
  error: string | null;
  /** 服务端最后一次写入时间（ms）；0 表示服务端还没有数据 */
  updatedAt: number;
}

export const NO_FAMILY_FLAGS: incomeApi.IncomeFamilyFlags = { hukouBeijing: false, child: false };

export const DEFAULT_INCOME_STATE: IncomeState = {
  members: [],
  dealWan: 381,
  downRatio: 0.35,
  years: 25,
  second: false,
  family: NO_FAMILY_FLAGS,
};

const RELATIONS: MemberRelation[] = ["self", "spouse", "child", "parent", "other"];
const HF_STATES: ContributionState[] = ["active", "paused", "none"];

let seq = 0;

function createUid(): string {
  seq += 1;
  return "inc-" + Date.now().toString(36) + "-" + seq.toString(36);
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickRelation(value: unknown): MemberRelation {
  return RELATIONS.includes(value as MemberRelation) ? (value as MemberRelation) : "other";
}

function pickHfState(value: unknown): ContributionState {
  return HF_STATES.includes(value as ContributionState) ? (value as ContributionState) : "active";
}

/** 服务端数据理论上已被 schema 校验过，这里再兜一层：坏行直接丢，金额不为负。 */
function normalizeMember(raw: unknown): IncomeMember | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    uid: typeof row.uid === "string" && row.uid ? row.uid : createUid(),
    name: typeof row.name === "string" ? row.name : "",
    relation: pickRelation(row.relation),
    monthlyNet: Math.max(0, num(row.monthlyNet, 0)),
    bonusAnnual: Math.max(0, num(row.bonusAnnual, 0)),
    hfMonthly: Math.max(0, num(row.hfMonthly, 0)),
    hfBalance: Math.max(0, num(row.hfBalance, 0)),
    hfYears: Math.max(0, num(row.hfYears, 0)),
    hfState: pickHfState(row.hfState),
    hfInBeijing: row.hfInBeijing !== false,
  };
}

function toFamilyFlags(raw: unknown): incomeApi.IncomeFamilyFlags {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { hukouBeijing: row.hukouBeijing === true, child: row.child === true };
}

function toState(doc: incomeApi.IncomeDoc | undefined): IncomeState {
  const src = (doc && typeof doc === "object" ? doc : {}) as Record<string, unknown>;
  const members = Array.isArray(src.members)
    ? src.members.map(normalizeMember).filter((member): member is IncomeMember => member !== null)
    : [];
  return {
    members,
    dealWan: Math.max(0, num(src.dealWan, DEFAULT_INCOME_STATE.dealWan)),
    downRatio: Math.min(0.9, Math.max(0, num(src.downRatio, DEFAULT_INCOME_STATE.downRatio))),
    years: Math.min(30, Math.max(1, Math.round(num(src.years, DEFAULT_INCOME_STATE.years)))),
    second: src.second === true,
    family: toFamilyFlags(src.family),
  };
}

let current: IncomeSnapshot = { ...DEFAULT_INCOME_STATE, phase: "unpaired", error: null, updatedAt: 0 };
const listeners = new Set<() => void>();

function commit(patch: Partial<IncomeSnapshot>): void {
  current = { ...current, ...patch };
  listeners.forEach((notify) => notify());
}

export function subscribeIncome(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function getIncomeState(): IncomeSnapshot {
  return current;
}

export function useIncomeState(): IncomeSnapshot {
  return useSyncExternalStore(subscribeIncome, getIncomeState, getIncomeState);
}

function applyResponse(res: incomeApi.IncomeResponse): void {
  commit({ ...toState(res.doc), phase: "ready", error: null, updatedAt: Date.parse(res.updatedAt) || Date.now() });
}

function fail(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  commit({ phase: isPaired() ? "error" : "unpaired", error: message });
}

let inflight = false;

/** 从服务器整份读回来：启动、回到前台、配对成功后各调一次（不轮询）。 */
export async function loadIncome(): Promise<void> {
  await bootServer();
  if (!isPaired()) {
    commit({ phase: "unpaired", error: null });
    return;
  }
  if (inflight) return;
  inflight = true;
  if (current.phase !== "ready") commit({ phase: "loading", error: null });
  try {
    applyResponse(await incomeApi.fetchIncome());
  } catch (err) {
    fail(err);
  } finally {
    inflight = false;
  }
}

// 测算参数：本地立即生效，350ms 内合并成一次 PATCH —— 连点首付比例不会打出一串请求
let pendingPatch: incomeApi.IncomeSettingsPatch = {};
let patchTimer: ReturnType<typeof setTimeout> | null = null;

export function patchIncomeState(patch: Partial<IncomeState>): void {
  const { members: _members, ...settings } = patch;
  commit(patch);
  if (!isPaired()) {
    commit({ phase: "unpaired" });
    return;
  }
  pendingPatch = { ...pendingPatch, ...settings };
  if (patchTimer) clearTimeout(patchTimer);
  patchTimer = setTimeout(() => {
    const body = pendingPatch;
    pendingPatch = {};
    patchTimer = null;
    void flushSettings(body);
  }, 350);
}

async function flushSettings(body: incomeApi.IncomeSettingsPatch): Promise<void> {
  if (Object.keys(body).length === 0) return;
  try {
    applyResponse(await incomeApi.patchSettings(body));
  } catch (err) {
    fail(err);
  }
}

/** 成员编辑：先乐观上屏，再把服务端返回的整份结果对齐。失败抛给调用方去 toast。 */
export async function upsertMember(member: IncomeMember): Promise<void> {
  const exists = current.members.some((row) => row.uid === member.uid);
  const optimistic = exists
    ? current.members.map((row) => (row.uid === member.uid ? member : row))
    : [...current.members, member];
  commit({ members: optimistic });
  try {
    applyResponse(await incomeApi.postMember(member));
  } catch (err) {
    fail(err);
    throw err;
  }
}

export async function removeMember(uid: string): Promise<void> {
  commit({ members: current.members.filter((row) => row.uid !== uid) });
  try {
    applyResponse(await incomeApi.deleteMember(uid));
  } catch (err) {
    fail(err);
    throw err;
  }
}

/** 新成员的默认画像：默认按老婆录，缴存状态正常、在京。 */
export function createMember(relation: MemberRelation = "spouse"): IncomeMember {
  return {
    uid: createUid(),
    name: "",
    relation,
    monthlyNet: 0,
    bonusAnnual: 0,
    hfMonthly: 0,
    hfBalance: 0,
    hfYears: 0,
    hfState: "active",
    hfInBeijing: true,
  };
}

/** 启动：连服务器就整份读；回到前台 / 网络恢复时再对齐一次。 */
export function startIncomeBoot(): void {
  void loadIncome();
  if (typeof window === "undefined") return;
  window.addEventListener("focus", () => void loadIncome());
  window.addEventListener("online", () => void loadIncome());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadIncome();
  });
}
