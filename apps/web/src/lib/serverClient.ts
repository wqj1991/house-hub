import { api, configureApi, inTauri, setUnauthorizedHandler } from "@house/data";
import { ApiRoutes } from "@house/protocol";
import { getAccount, setAccount, type AccountProfile } from "./account";
import { getToken, setToken } from "./session";

/**
 * 服务器连接：地址 + 设备令牌。
 * 数据全部住在服务端，本机只留「连哪台服务器」和「我是哪台设备」。
 * 地址留空＝同源部署（Web 走反代，桌面/移动要填 http://<服务器>:8787）。
 */

const BASE_KEY = "house-hub:sync:base";
const DEVICE_KEY = "house-hub:sync:device";
/** 用户主动退出的标记：有它就不再拿默认密钥自动配对，否则退出登录会被下一次 bootServer 立刻登回去。 */
const LOGOUT_KEY = "house-hub:sync:loggedout";

/**
 * 默认后端：开发期直连本机 services/api；打包与同源部署留空，走相对路径 /house-api 反代。
 * 换服务器用 VITE_HOUSE_SERVER / VITE_HOUSE_PAIR_KEY。
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
/** dev 里只有在本机 loopback 打开时才直连本机端口；真机 / 安卓 adb reverse 访问时走同源 /house-api
 *  由 vite proxy 转发（设备侧到不了宿主端口，写死 127.0.0.1 会变成设备自己的回环 → 接口没通）。 */
const DEV_DIRECT = import.meta.env.DEV && LOOPBACK.has(window.location.hostname);
/** 本机 8787 落在 Windows netsh 保留段（8699-8798）→ 监听时报 EACCES，故开发期默认 18878
 *  （见 scripts/android-dev.sh:60）。两个都探一遍，谁活着用谁，换机器不用改代码。 */
const DEV_PORTS = [18878, 8787];
const DEFAULT_BASE =
  (import.meta.env.VITE_HOUSE_SERVER as string | undefined)?.trim() ||
  (DEV_DIRECT ? `http://127.0.0.1:${DEV_PORTS[0]}` : "");


/** 存进 localStorage 的地址只留「协议+主机+端口」：以前手填过 /house-api 的旧值在这里一并纠正。 */
function cleanBase(raw: string): string {
  const next = raw.trim().replace(/\/+$/, "");
  return next.endsWith("/house-api") ? next.slice(0, -"/house-api".length).replace(/\/+$/, "") : next;
}

/** 服务器错误原文形如「401 unauthorized: 账号或密码不对」，界面上只留人话那半段。 */
export function humanError(err: unknown, fallback = "没成功"): string {
  const raw = typeof err === "string" ? err : ((err as Error | undefined)?.message ?? "");
  const matched = raw.match(/^\s*\d{3}\s*[\w-]*\s*:\s*([\s\S]+)$/);
  const text = (matched ? matched[1] : raw).trim();
  return text || fallback;
}

export function getServerBase(): string {
  try {
    return cleanBase(localStorage.getItem(BASE_KEY) ?? DEFAULT_BASE);
  } catch {
    return cleanBase(DEFAULT_BASE);
  }
}

function setLoggedOut(next: boolean): void {
  try {
    if (next) localStorage.setItem(LOGOUT_KEY, "1");
    else localStorage.removeItem(LOGOUT_KEY);
  } catch {
    /* 隐私模式下忽略 */
  }
}

/** 用户是否自己填过地址（没填就该跟随本机实际在跑的那个端口）。 */
function hasStoredBase(): boolean {
  try {
    return Boolean(localStorage.getItem(BASE_KEY));
  } catch {
    return false;
  }
}

/** 开发期挑一个活着的本机端口：18878 优先（8787 在 Windows 上常被保留段占掉）。 */
let devBase: string | null = null;
async function pickDevBase(): Promise<string> {
  if (devBase) return devBase;
  for (const port of DEV_PORTS) {
    const candidate = `http://127.0.0.1:${port}`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 800);
      const res = await fetch(`${candidate}/house-api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        devBase = candidate;
        return candidate;
      }
    } catch {
      /* 这个端口没起来，试下一个 */
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 800);
      const res = await fetch(`${candidate}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        devBase = candidate;
        return candidate;
      }
    } catch {
      /* 同上 */
    }
  }
  devBase = `http://127.0.0.1:${DEV_PORTS[0]}`;
  return devBase;
}

export function saveServerBase(base: string): void {
  const clean = cleanBase(base);
  try {
    if (clean) localStorage.setItem(BASE_KEY, clean);
    else localStorage.removeItem(BASE_KEY);
  } catch {
    /* 隐私模式下忽略 */
  }
  configureApi({ base: clean });
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev_" + randomId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "dev_unknown";
  }
}

function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 16);
  return Math.random().toString(36).slice(2, 18);
}

/**
 * 每次网络调用前接一次地址与令牌，不依赖启动顺序。
 * 进应用要账号密码登录，所以这里绝不偷偷换令牌：没登录就停在登录页。
 */
export async function bootServer(): Promise<void> {
  // 没手填地址时探一次本机端口，避免"服务器在 18878、默认写 8787"这种必然失败的组合
  const base = DEV_DIRECT && !hasStoredBase() ? await pickDevBase() : getServerBase();
  configureApi({ base, token: getToken() ?? undefined });
}

export interface LoginOptions {
  base?: string;
  platform?: "desktop" | "android" | "web";
}

/**
 * 账号密码登录：服务器验过账号密码才发设备令牌，本机只留令牌，不留密码。
 * 登录成功顺带解除「已退出」标记，换账号也从这里走。
 */
export async function login(username: string, password: string, opts: LoginOptions = {}): Promise<{ deviceId: string }> {
  if (opts.base !== undefined) saveServerBase(opts.base);
  await bootServer();
  const res = await api<{ deviceId: string; token: string; username?: string }>(ApiRoutes.authLogin, {
    method: "POST",
    body: JSON.stringify({
      username: username.trim(),
      password,
      deviceName: inTauri ? "house-hub App" : "Web 工作台",
      platform: opts.platform ?? (inTauri ? "android" : "web"),
    }),
  });
  setLoggedOut(false);
  setToken(res.token);
  setAccount({ username: res.username || username.trim() });
  try {
    localStorage.setItem(DEVICE_KEY, res.deviceId);
  } catch {
    /* 隐私模式忽略 */
  }
  return { deviceId: res.deviceId };
}

export function isPaired(): boolean {
  return Boolean(getToken());
}

/**
 * 拿服务端认的当前账号：卡片上显示谁，全看这一嗓子。
 * 失败就沿用本机记着的那个名字，不把界面拖成空白。
 */
export async function loadAccount(): Promise<AccountProfile | null> {
  await bootServer();
  if (!isPaired()) {
    setAccount(null);
    return null;
  }
  try {
    const me = await api<AccountProfile & { username: string }>(ApiRoutes.authMe);
    const next: AccountProfile = {
      username: me.username,
      role: me.role,
      accountId: me.accountId ?? null,
      platform: me.platform,
      deviceName: me.deviceName,
      avatar: me.avatar ?? null,
    };
    setAccount(next);
    return next;
  } catch {
    return getAccount();
  }
}

/**
 * 换头像：传 data URL 存到账号上，手机与 web 看的是同一张；传 null 退回初始字母。
 * 尺寸与压缩在前端做（canvas 缩到 256×256 的 jpeg），服务端只管存。
 */
export async function saveAvatar(avatar: string | null): Promise<string | null> {
  const res = await api<{ avatar: string | null }>(ApiRoutes.accountAvatar, {
    method: "POST",
    body: JSON.stringify({ avatar }),
  });
  const current = getAccount();
  if (current) setAccount({ ...current, avatar: res.avatar });
  return res.avatar;
}

/**
 * 服务器说这份令牌不认了（换库 / 撤设备 / 重启后换了密钥），本机就别再拿它当「已配对」。
 * 清掉之后 UI 立刻回到未连接，配对码输入框就在眼前；有默认密钥时下一次 bootServer 会自动重配。
 */
setUnauthorizedHandler(() => {
  setAccount(null);
  if (getToken()) setToken(null);
});

/** 只清本机凭证，不碰服务器：令牌已经失效时用它把界面拉回「未连接」，重新贴配对码。 */
export function forgetLocalToken(): void {
  setLoggedOut(true);
  setAccount(null);
  setToken(null);
}

export interface PairOptions {
  base?: string;
  deviceName?: string;
  platform?: "desktop" | "android" | "web";
}

/**
 * 换设备令牌（D3）：给 6 位配对码，或给服务器上那条长期配对密钥（HOUSE_PAIR_KEY）。
 * 6 位码由 /internal/pair/code 现出、一次有效；密钥贴一次就能一直用。
 */
export async function pairDevice(secret: string, opts: PairOptions = {}): Promise<{ deviceId: string }> {
  // 主动登录＝解除退出标记，退出后自动配对才不会被继续压着
  setLoggedOut(false);
  if (opts.base !== undefined) saveServerBase(opts.base);
  await bootServer();
  const raw = secret.trim();
  const payload = /^\d{6}$/.test(raw) ? { code: raw } : { key: raw };
  const res = await api<{ deviceId: string; token: string }>(ApiRoutes.authPair, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      deviceName: opts.deviceName || (inTauri ? "house-hub App" : "Web 工作台"),
      platform: opts.platform ?? (inTauri ? "android" : "web"),
    }),
  });
  setToken(res.token);
  try {
    localStorage.setItem(DEVICE_KEY, res.deviceId);
  } catch {
    /* 忽略 */
  }
  return { deviceId: res.deviceId };
}

/** 断开本设备：服务器吊销令牌，本机清空凭证，数据仍在服务器上。 */
export async function revokeDevice(): Promise<void> {
  await bootServer();
  if (!isPaired()) return;
  try {
    await api(ApiRoutes.authRevoke, { method: "POST" });
  } catch (err) {
    // 令牌早被服务端换掉了（401）时，"吊销"这一步没意义；本地凭证照样要清，不然断不开也连不上。
    if (!/^401\b/.test((err as Error).message)) throw err;
  }
  // 退出后不许被默认密钥自动登回去：先立标记，再清身份与令牌
  setLoggedOut(true);
  setAccount(null);
  setToken(null);
}
