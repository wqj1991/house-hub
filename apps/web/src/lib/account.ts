import { useSyncExternalStore } from "react";

/**
 * 「现在登录的是谁」：字面意义上的当前账号。
 * 登录成功时直接从登录响应写进来，之后用 /auth/me 校准；退出登录、令牌失效一并清空。
 */

export interface AccountProfile {
  username: string;
  role?: "admin" | "member";
  accountId?: string | null;
  platform?: string;
  deviceName?: string;
  /** 256×256 的 jpeg data URL；空就退回首字母头像 */
  avatar?: string | null;
}

const KEY = "house-hub:sync:account";
const listeners = new Set<() => void>();
let snapshot: AccountProfile | null | undefined;

function readStored(): AccountProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountProfile;
    return parsed && typeof parsed.username === "string" && parsed.username ? parsed : null;
  } catch {
    return null;
  }
}

function emit(): void {
  for (const fn of listeners) fn();
}

export function subscribeAccount(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 快照要稳定：解析过的对象缓存在内存里，别每次返回新对象把 React 转晕。 */
export function getAccount(): AccountProfile | null {
  if (snapshot === undefined) snapshot = readStored();
  return snapshot;
}

export function setAccount(next: AccountProfile | null): void {
  snapshot = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* 隐私模式下只留内存 */
  }
  emit();
}

export function useAccount(): AccountProfile | null {
  return useSyncExternalStore(subscribeAccount, getAccount, getAccount);
}
