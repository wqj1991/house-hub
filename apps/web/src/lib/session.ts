import { configureApi } from "@house/data";

const KEY = "house-hub:token";

/** 令牌变更订阅：UI 用 useSyncExternalStore 跟着变，401 被清掉时配对入口能立刻出现。 */
const listeners = new Set<() => void>();

export function subscribeToken(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  const before = getToken();
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* 隐私模式下忽略 */
  }
  configureApi({ token: token ?? undefined });
  if (before !== (token ?? null)) {
    for (const fn of listeners) fn();
  }
}

/** 启动时接上令牌；支持 ?token=xxx 一次性注入（扫码跨设备调试用），注入后从地址栏抹掉。 */
export function bootApi(): void {
  const url = new URL(window.location.href);
  const injected = url.searchParams.get("token");
  if (injected) {
    setToken(injected);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.toString());
    return;
  }
  setToken(getToken());
}

export async function pair(code: string): Promise<void> {
  const res = await fetch("/house-api/auth/pair", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ code, deviceName: "Web 工作台", platform: "web" }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !body.token) throw new Error(body.message ?? `配对失败（${res.status}）`);
  setToken(body.token);
}
