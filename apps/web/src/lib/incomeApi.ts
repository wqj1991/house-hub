import { api } from "@house/data";
import { ApiRoutes } from "@house/protocol";
import { bootServer } from "./serverClient";

/** 收入与公积金的服务端接口：每调用一次就是一次真实请求，返回服务端最新的整份文档。 */

export interface IncomeFamilyFlags {
  hukouBeijing: boolean;
  child: boolean;
}

export interface IncomeDoc {
  members: unknown[];
  dealWan: number;
  downRatio: number;
  years: number;
  second: boolean;
  family: IncomeFamilyFlags;
}

export interface IncomeResponse {
  doc: IncomeDoc;
  updatedAt: string;
}

export type IncomeSettings = Omit<IncomeDoc, "members">;
export type IncomeSettingsPatch = Partial<IncomeSettings>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  await bootServer();
  return api<T>(path, init);
}

function jsonBody(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}

export function fetchIncome(): Promise<IncomeResponse> {
  return call<IncomeResponse>(ApiRoutes.income);
}

export function putIncome(doc: IncomeDoc): Promise<IncomeResponse> {
  return call<IncomeResponse>(ApiRoutes.income, { method: "PUT", body: JSON.stringify(doc) });
}

/** 新增与编辑同一个口：服务端按 uid 覆盖写。 */
export function postMember(member: unknown): Promise<IncomeResponse> {
  return call<IncomeResponse>(ApiRoutes.incomeMembers, jsonBody(member));
}

export function patchMember(uid: string, patch: unknown): Promise<IncomeResponse> {
  const path = ApiRoutes.incomeMember.replace(":uid", encodeURIComponent(uid));
  return call<IncomeResponse>(path, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteMember(uid: string): Promise<IncomeResponse> {
  const path = ApiRoutes.incomeMember.replace(":uid", encodeURIComponent(uid));
  return call<IncomeResponse>(path, { method: "DELETE" });
}

export function patchSettings(patch: IncomeSettingsPatch): Promise<IncomeResponse> {
  return call<IncomeResponse>(ApiRoutes.incomeSettings, { method: "PATCH", body: JSON.stringify(patch) });
}
