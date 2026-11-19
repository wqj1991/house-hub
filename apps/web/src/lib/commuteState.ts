import { useSyncExternalStore } from "react";
import { bindShuttle } from "@house/core";
import type { CommuteHabit, CommuteProfile, OfficeLocation, ShuttleBinding, ShuttlePlan, ShuttleSeat, CommuteVehicle } from "@house/core";
import * as commuteApi from "./commuteApi";
import { bootServer, isPaired } from "./serverClient";

/**
 * 通勤画像：公司地点 + 多条通勤习惯（含班车）。
 * 与收入同一套做法：数据住服务端，这里只是它的镜像 + 请求状态，没有本地缓存、没有离线队列。
 */

export type CommutePhase = "unpaired" | "loading" | "ready" | "error";

export interface CommuteSnapshot extends CommuteProfile {
  phase: CommutePhase;
  error: string | null;
  /** 服务端最后一次写入时间（ms）；0 表示服务端还没有数据 */
  updatedAt: number;
}

const VEHICLES: CommuteVehicle[] = ["transit", "shuttle", "walk", "ebike"];
const LEGACY_VEHICLE: Record<string, CommuteVehicle> = { metro: "transit", bus: "transit", drive: "transit", bike: "ebike" };
const SEATS: ShuttleSeat[] = ["reserved", "firstCome", "unknown"];

let seq = 0;

function createUid(prefix: string): string {
  seq += 1;
  return prefix + "-" + Date.now().toString(36) + "-" + seq.toString(36);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function normalizeShuttle(raw: unknown): ShuttlePlan | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    line: str(row.line),
    stop: str(row.stop),
    depart: str(row.depart),
    arrive: str(row.arrive),
    seat: SEATS.includes(row.seat as ShuttleSeat) ? (row.seat as ShuttleSeat) : "unknown",
    lastReturn: str(row.lastReturn),
    toGate: row.toGate !== false,
    note: str(row.note),
  };
}

/** 服务端数据理论上已被 schema 校验过，这里再兜一层：坏行直接丢，时长不为负。 */
function normalizeOffice(raw: unknown): OfficeLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = str(row.name).trim();
  if (!name) return null;
  return {
    uid: str(row.uid) || createUid("off"),
    name,
    address: str(row.address),
    poiId: str(row.poiId),
    poiName: str(row.poiName),
    lng: num(row.lng, 0),
    lat: num(row.lat, 0),
    city: str(row.city),
    district: str(row.district),
    adcode: str(row.adcode),
    beIn: str(row.beIn, "09:00"),
    daysPerWeek: clamp(Math.round(num(row.daysPerWeek, 5)), 0, 7),
    note: str(row.note),
  };
}

function normalizeHabit(raw: unknown): CommuteHabit | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const rawVehicle = typeof row.vehicle === "string" ? LEGACY_VEHICLE[row.vehicle] ?? row.vehicle : "";
  const vehicle = VEHICLES.includes(rawVehicle as CommuteVehicle) ? (rawVehicle as CommuteVehicle) : "transit";
  return {
    uid: str(row.uid) || createUid("cm"),
    label: str(row.label),
    vehicle,
    minutes: clamp(num(row.minutes, 0), 0, 600),
    departHome: str(row.departHome),
    arriveWork: str(row.arriveWork),
    daysPerWeek: clamp(Math.round(num(row.daysPerWeek, 5)), 0, 7),
    primary: row.primary === true,
    officeUid: str(row.officeUid),
    memberUid: str(row.memberUid),
    accessHome: row.accessHome === "ebike" ? "ebike" : "walk",
    accessWork: row.accessWork === "ebike" ? "ebike" : "walk",
    shuttle: vehicle === "shuttle" ? normalizeShuttle(row.shuttle) : null,
    note: str(row.note),
  };
}

/** 归属行：线路号统一大写，缺 officeUid 当「未分配」。 */
function normalizeBinding(row: unknown): ShuttleBinding | null {
  if (!row || typeof row !== "object") return null;
  const src = row as Record<string, unknown>;
  const code = str(src.code).trim().toUpperCase();
  if (!code) return null;
  return { code, officeUid: str(src.officeUid) };
}

function toState(doc: commuteApi.CommuteDoc | undefined): CommuteProfile {
  const src = (doc && typeof doc === "object" ? doc : {}) as Record<string, unknown>;
  const offices = Array.isArray(src.offices)
    ? src.offices.map(normalizeOffice).filter((row): row is OfficeLocation => row !== null)
    : [];
  const habits = Array.isArray(src.habits)
    ? src.habits.map(normalizeHabit).filter((row): row is CommuteHabit => row !== null)
    : [];
  const shuttles = Array.isArray(src.shuttles)
    ? src.shuttles.map(normalizeBinding).filter((row): row is ShuttleBinding => row !== null)
    : [];
  return { offices, habits, shuttles };
}

let current: CommuteSnapshot = { offices: [], habits: [], shuttles: [], phase: "unpaired", error: null, updatedAt: 0 };
const listeners = new Set<() => void>();

function commit(patch: Partial<CommuteSnapshot>): void {
  current = { ...current, ...patch };
  listeners.forEach((notify) => notify());
}

export function subscribeCommute(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function getCommuteState(): CommuteSnapshot {
  return current;
}

export function useCommuteState(): CommuteSnapshot {
  return useSyncExternalStore(subscribeCommute, getCommuteState, getCommuteState);
}

function applyResponse(res: commuteApi.CommuteResponse): void {
  commit({ ...toState(res.doc), phase: "ready", error: null, updatedAt: Date.parse(res.updatedAt) || Date.now() });
}

function fail(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  commit({ phase: isPaired() ? "error" : "unpaired", error: message });
}

let inflight = false;

/** 从服务器整份读回来：启动、回到前台、配对成功后各调一次（不轮询）。 */
export async function loadCommute(): Promise<void> {
  await bootServer();
  if (!isPaired()) {
    commit({ phase: "unpaired", error: null });
    return;
  }
  if (inflight) return;
  inflight = true;
  if (current.phase !== "ready") commit({ phase: "loading", error: null });
  try {
    applyResponse(await commuteApi.fetchCommute());
  } catch (err) {
    fail(err);
  } finally {
    inflight = false;
  }
}

/** 主用方案本地先摘干净：服务端也会做同样的事，这里只是让界面不闪。 */
function localPrimary(habits: CommuteHabit[], habit: CommuteHabit): CommuteHabit[] {
  return habits.map((row) => (row.uid === habit.uid ? habit : habit.primary ? { ...row, primary: false } : row));
}

/** 公司地点编辑：先乐观上屏，再把服务端返回的整份结果对齐。失败抛给调用方去 toast。 */
export async function saveOffice(office: OfficeLocation): Promise<void> {
  const exists = current.offices.some((row) => row.uid === office.uid);
  const optimistic = exists
    ? current.offices.map((row) => (row.uid === office.uid ? office : row))
    : [...current.offices, office];
  commit({ offices: optimistic });
  try {
    applyResponse(await commuteApi.postOffice(office));
  } catch (err) {
    fail(err);
    throw err;
  }
}

export async function removeOffice(uid: string): Promise<void> {
  const habits = current.habits.map((row) => (row.officeUid === uid ? { ...row, officeUid: "" } : row));
  const shuttles = current.shuttles.map((row) => (row.officeUid === uid ? { ...row, officeUid: "" } : row));
  commit({ offices: current.offices.filter((row) => row.uid !== uid), habits, shuttles });
  try {
    applyResponse(await commuteApi.deleteOffice(uid));
  } catch (err) {
    fail(err);
    throw err;
  }
}

/** 通勤习惯编辑：可以有很多条，同一条按 uid 覆盖。 */
export async function saveHabit(habit: CommuteHabit): Promise<void> {
  const exists = current.habits.some((row) => row.uid === habit.uid);
  const base = exists ? current.habits.map((row) => (row.uid === habit.uid ? habit : row)) : [...current.habits, habit];
  commit({ habits: localPrimary(base, habit) });
  try {
    applyResponse(await commuteApi.postHabit(habit));
  } catch (err) {
    fail(err);
    throw err;
  }
}

export async function removeHabit(uid: string): Promise<void> {
  commit({ habits: current.habits.filter((row) => row.uid !== uid) });
  try {
    applyResponse(await commuteApi.deleteHabit(uid));
  } catch (err) {
    fail(err);
    throw err;
  }
}

/** 班车归属：一条线路只能挂一处公司，改公司就是改这一行。 */
export async function saveShuttleBinding(code: string, officeUid: string): Promise<void> {
  const upper = code.trim().toUpperCase();
  commit({ shuttles: bindShuttle(current.shuttles, upper, officeUid) });
  try {
    applyResponse(await commuteApi.postShuttleLink(upper, officeUid));
  } catch (err) {
    fail(err);
    throw err;
  }
}

/** 新公司地点的默认画像：到岗 09:00、每周去 5 天；坐标等用户在高德里选中再填。 */
export function createOffice(): OfficeLocation {
  return {
    uid: createUid("off"),
    name: "",
    address: "",
    poiId: "",
    poiName: "",
    lng: 0,
    lat: 0,
    city: "",
    district: "",
    adcode: "",
    beIn: "09:00",
    daysPerWeek: 5,
    note: "",
  };
}

/** 新通勤习惯：默认公共交通主用；选了班车再补班车信息。 */
export function createHabit(vehicle: CommuteVehicle = "transit"): CommuteHabit {
  const primary = current.habits.length === 0;
  return {
    uid: createUid("cm"),
    label: "",
    vehicle,
    minutes: 0,
    departHome: "",
    arriveWork: "",
    daysPerWeek: 5,
    primary,
    officeUid: current.offices[0]?.uid ?? "",
    memberUid: "",
    accessHome: "walk",
    accessWork: "walk",
    shuttle: vehicle === "shuttle" ? createShuttle() : null,
    note: "",
  };
}

/** 班车默认壳：座位状态未知、默认停公司门口。 */
export function createShuttle(): ShuttlePlan {
  return { line: "", stop: "", depart: "", arrive: "", seat: "unknown", lastReturn: "", toGate: true, note: "" };
}

/** 启动：连服务器就整份读；回到前台 / 网络恢复时再对齐一次。 */
export function startCommuteBoot(): void {
  void loadCommute();
  if (typeof window === "undefined") return;
  window.addEventListener("focus", () => void loadCommute());
  window.addEventListener("online", () => void loadCommute());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadCommute();
  });
}
