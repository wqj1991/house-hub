import { useEffect, useSyncExternalStore } from "react";
import { api } from "@house/data";
import { ApiRoutes } from "@house/protocol";
import { bootServer } from "./serverClient";

/**
 * 公司班车线路库：和通勤习惯完全独立的一块。
 *
 * 数据住服务端 line / stop（首次启动由 core 快照 seed 一遍），这里既读也写：
 * 加线路、改司机电话车牌、增删站点、改发车时刻都直接落库，别的设备刷新即见。
 * 坐标是 GCJ-02（高德），留着以后算站点到公司的通勤时长。
 */

export interface ShuttleStopView {
  /** 库里的站点 uid（线路号-序号） */
  uid: string;
  seq: number;
  name: string;
  depart: string;
  lng: number;
  lat: number;
}

export interface ShuttleLineView {
  code: string;
  name: string;
  driver: string;
  phone: string;
  plate: string;
  arrive: string;
  active: boolean;
  stops: ShuttleStopView[];
}

export interface ShuttleLib {
  terminal: { name: string; lng: number; lat: number };
  lines: ShuttleLineView[];
  stopCount: number;
}

/** 提交线路时带的字段（code 只在新增时给）。 */
export interface ShuttleLineInput {
  code: string;
  name: string;
  driver: string;
  phone: string;
  plate: string;
  arrive: string;
  active: boolean;
}

/** 提交站点时带的字段（uid / seq 由服务端按顺序重排）。 */
export interface ShuttleStopInput {
  name: string;
  depart: string;
  lng: number;
  lat: number;
}

export function blankShuttleLine(): ShuttleLineInput {
  return { code: "", name: "", driver: "", phone: "", plate: "", arrive: "", active: true };
}

export function blankShuttleStop(): ShuttleStopInput {
  return { name: "", depart: "", lng: 0, lat: 0 };
}

export type ShuttlePhase = "idle" | "loading" | "ready" | "error";

export interface ShuttleSnapshot {
  lib: ShuttleLib | null;
  phase: ShuttlePhase;
  error: string | null;
}

let snapshot: ShuttleSnapshot = { lib: null, phase: "idle", error: null };
const listeners = new Set<() => void>();

function commit(next: Partial<ShuttleSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((notify) => notify());
}

export function subscribeShuttle(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

function getSnapshot(): ShuttleSnapshot {
  return snapshot;
}

export function shuttleErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/^401/.test(message)) return "设备令牌失效，重新配对后再试";
  if (/^404/.test(message)) return "服务端还是旧版 api（没有 /shuttle 接口），重启 house-api 再试";
  if (/^409|duplicate/.test(message)) return "线路号已经被占用了，换一个";
  if (/^400/.test(message)) return "填的内容不合法：" + message.replace(/^400\s+\w+:\s*/, "").slice(0, 100);
  if (/failed to fetch|networkerror|load failed|ECONN/i.test(message)) return "连不上服务器，确认 house-api 在跑";
  return "班车数据操作失败：" + message.slice(0, 120);
}

/** 把一次写操作返回的最新线路并进快照；线路不存在（删除后）就整份重拉。 */
function applyLine(line: ShuttleLineView | null, removedCode?: string): void {
  const lib = snapshot.lib;
  if (!lib || !line) {
    void loadShuttleLib();
    return;
  }
  const lines = removedCode
    ? lib.lines.filter((row) => row.code !== removedCode)
    : lib.lines.some((row) => row.code === line.code)
      ? lib.lines.map((row) => (row.code === line.code ? line : row))
      : [...lib.lines, line].sort((a, b) => a.code.localeCompare(b.code));
  commit({
    lib: { ...lib, lines, stopCount: lines.reduce((sum, row) => sum + row.stops.length, 0) },
    phase: "ready",
    error: null,
  });
}

let inflight: Promise<ShuttleLib | null> | null = null;

export function loadShuttleLib(): Promise<ShuttleLib | null> {
  if (inflight) return inflight;
  commit({ phase: "loading", error: null });
  inflight = (async () => {
    try {
      await bootServer();
      const lib = await api<ShuttleLib>(ApiRoutes.shuttleLines);
      commit({ lib, phase: "ready", error: null });
      return lib;
    } catch (err) {
      commit({ phase: "error", error: shuttleErrorMessage(err) });
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function write<T>(path: string, init: RequestInit): Promise<T> {
  await bootServer();
  return api<T>(path, init);
}

/** 新增或改线路：isNew 决定 POST / PATCH。 */
export async function saveShuttleLine(input: ShuttleLineInput, isNew: boolean): Promise<ShuttleLineView> {
  const code = input.code.trim().toUpperCase();
  const payload = {
    name: input.name.trim(),
    driver: input.driver.trim(),
    phone: input.phone.trim(),
    plate: input.plate.trim(),
    arrive: input.arrive.trim(),
    active: input.active,
  };
  const line = isNew
    ? await write<ShuttleLineView>(ApiRoutes.shuttleLines, { method: "POST", body: JSON.stringify({ code, ...payload }) })
    : await write<ShuttleLineView>(ApiRoutes.shuttleLine.replace(":code", encodeURIComponent(code)), {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
  applyLine(line);
  return line;
}

/** 整条替换站点：增删、排序一次提交。 */
export async function saveShuttleStops(code: string, stops: ShuttleStopInput[]): Promise<ShuttleLineView> {
  const line = await write<ShuttleLineView>(ApiRoutes.shuttleStops.replace(":code", encodeURIComponent(code)), {
    method: "PUT",
    body: JSON.stringify({
      stops: stops
        .filter((stop) => stop.name.trim().length > 0)
        .map((stop) => ({
          name: stop.name.trim(),
          depart: stop.depart.trim(),
          lng: Number(stop.lng) || 0,
          lat: Number(stop.lat) || 0,
        })),
    }),
  });
  applyLine(line);
  return line;
}

export async function removeShuttleLine(code: string): Promise<void> {
  await write<{ ok: boolean }>(ApiRoutes.shuttleLine.replace(":code", encodeURIComponent(code)), { method: "DELETE" });
  const row = snapshot.lib?.lines.find((line) => line.code === code) ?? null;
  if (snapshot.lib && row) applyLine(null, code);
  else void loadShuttleLib();
}

/** 第一次用到就拉；失败留在 error 态，交给页面给一个「重试」按钮。 */
export function useShuttleLib(): ShuttleSnapshot {
  const snap = useSyncExternalStore(subscribeShuttle, getSnapshot, getSnapshot);
  useEffect(() => {
    if (snap.phase === "idle") void loadShuttleLib();
  }, [snap.phase]);
  return snap;
}

/** 写操作的进度（保存中禁用按钮用）。 */
let saving = false;
const savingListeners = new Set<() => void>();

function setSaving(next: boolean): void {
  saving = next;
  savingListeners.forEach((notify) => notify());
}

export function useShuttleSaving(): boolean {
  return useSyncExternalStore(
    (notify) => {
      savingListeners.add(notify);
      return () => savingListeners.delete(notify);
    },
    () => saving,
    () => saving,
  );
}

/** 包一层：进入保存态、失败转成可读文案再抛出，调用方只管 toast。 */
export async function runShuttleWrite<T>(task: () => Promise<T>): Promise<T> {
  setSaving(true);
  try {
    return await task();
  } catch (err) {
    throw new Error(shuttleErrorMessage(err));
  } finally {
    setSaving(false);
  }
}
