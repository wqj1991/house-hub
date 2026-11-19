import { api } from "@house/data";
import { ApiRoutes } from "@house/protocol";
import { bootServer } from "./serverClient";

/** 通勤画像的服务端接口：每调用一次就是一次真实请求，返回服务端最新的整份文档。 */

export interface CommuteDoc {
  offices: unknown[];
  habits: unknown[];
  /** 线路号 → 公司地点 的归属表 */
  shuttles: unknown[];
}

export interface CommuteResponse {
  doc: CommuteDoc;
  updatedAt: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  await bootServer();
  return api<T>(path, init);
}

function jsonBody(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}

export function fetchCommute(): Promise<CommuteResponse> {
  return call<CommuteResponse>(ApiRoutes.commute);
}

export function putCommute(doc: CommuteDoc): Promise<CommuteResponse> {
  return call<CommuteResponse>(ApiRoutes.commute, { method: "PUT", body: JSON.stringify(doc) });
}

/** 公司地点：新增与编辑同一个口，服务端按 uid 覆盖写。 */
export function postOffice(office: unknown): Promise<CommuteResponse> {
  return call<CommuteResponse>(ApiRoutes.commuteOffices, jsonBody(office));
}

export function deleteOffice(uid: string): Promise<CommuteResponse> {
  const path = ApiRoutes.commuteOffice.replace(":uid", encodeURIComponent(uid));
  return call<CommuteResponse>(path, { method: "DELETE" });
}

/** 通勤习惯：同一口覆盖写；标了 primary 的会把别的摘掉。 */
export function postHabit(habit: unknown): Promise<CommuteResponse> {
  return call<CommuteResponse>(ApiRoutes.commuteHabits, jsonBody(habit));
}

export function patchHabit(uid: string, patch: unknown): Promise<CommuteResponse> {
  const path = ApiRoutes.commuteHabit.replace(":uid", encodeURIComponent(uid));
  return call<CommuteResponse>(path, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteHabit(uid: string): Promise<CommuteResponse> {
  const path = ApiRoutes.commuteHabit.replace(":uid", encodeURIComponent(uid));
  return call<CommuteResponse>(path, { method: "DELETE" });
}

/** 班车归属：把线路号挂到某处公司地点（officeUid 传空串＝取消归属）。 */
export function postShuttleLink(code: string, officeUid: string): Promise<CommuteResponse> {
  return call<CommuteResponse>(ApiRoutes.commuteShuttles, jsonBody({ code, officeUid }));
}
