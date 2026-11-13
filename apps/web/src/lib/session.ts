import { configureApi } from "@house/data";

const KEY = "house-hub:token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* 隐私模式下忽略 */
  }
  configureApi({ token: token ?? undefined });
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
