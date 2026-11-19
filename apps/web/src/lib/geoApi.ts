import { api } from "@house/data";
import { ApiRoutes } from "@house/protocol";
import { bootServer } from "./serverClient";

/**
 * 高德地点检索的客户端：只问自家服务端的 /geo/*，Key 不在这一层，
 * 浏览器和手机都拿不到，也就不存在把 Key 打进安装包的麻烦。
 */

export interface GeoPlace {
  /** 高德 POI / 提示 id：公司地点存它，服务端据此认定地点确实来自高德 */
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  adcode: string;
  lng: number;
  lat: number;
  typecode: string;
}

export interface GeoStatus {
  configured: boolean;
  city: string;
}

function errorCode(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const matched = /^\d{3}\s+([a-z_]+):/.exec(message);
  return matched ? matched[1] : "";
}

/** 服务端没配 Key / Key 被判无效时，页面给出「去找服务器配 Key」而不是「搜索无结果」。 */
export function isGeoUnconfigured(err: unknown): boolean {
  const code = errorCode(err);
  return code === "amap_unconfigured" || code === "amap_key_invalid";
}

/**
 * 失败原因说到点子上：旧版 api 没有 /geo 接口、Key 没配、Key 无效、网络不通，
 * 页面别一律「稍后再试」，否则查不出到底哪一层坏了。
 */
export function geoErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = errorCode(err);
  if (code === "amap_unconfigured") return "服务端还没配置高德 Key（HOUSE_AMAP_KEY）";
  if (code === "amap_key_invalid") return "高德 Key 无效或被禁用，去服务器换一条";
  if (/^404\b/.test(message)) return "服务端还是旧版 api（没有 /geo 接口），重启 house-api 再试";
  if (/^401\b/.test(message)) return "设备令牌失效，重新配对后再试";
  if (/Failed to fetch|NetworkError|load failed/i.test(message)) return "连不上服务器，检查网络或后端是否在跑";
  return "高德搜索失败：" + message.replace(/^\d{3}\s+/, "").slice(0, 120);
}

export async function fetchGeoStatus(): Promise<GeoStatus> {
  await bootServer();
  return api<GeoStatus>(ApiRoutes.geoStatus);
}

/** 浏览器画地图要的那把 Key：服务端 /geo/map-config 现取，前端仓库不存 Key。 */
export interface GeoMapConfig {
  configured: boolean;
  city: string;
  key: string;
}

export async function fetchGeoMapConfig(): Promise<GeoMapConfig> {
  await bootServer();
  return api<GeoMapConfig>(ApiRoutes.geoMapConfig);
}

/** 一段驾车路径：points 是 GCJ-02 的点串，可直接喂给 AMap.Polyline。 */
export interface GeoDrivePath {
  distance: number;
  duration: number;
  points: { lng: number; lat: number }[];
}

/**
 * 两坐标之间的驾车折线。为什么不直接在浏览器里 new AMap.Driving：
 * 那个插件会带 s=rsv3 打 restapi.amap.com/v3/direction/driving，这把 Key 没开
 * 数字签名，必然回 USERKEY_PLAT_NOMATCH —— 折线只能由服务端算。
 * 算不出来返回 null（起终点不在可驾车道路附近），不算错误。
 */
export async function fetchGeoRoute(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  opts: { signal?: AbortSignal } = {},
): Promise<GeoDrivePath | null> {
  await bootServer();
  const qs = new URLSearchParams({
    from: from.lng.toFixed(6) + "," + from.lat.toFixed(6),
    to: to.lng.toFixed(6) + "," + to.lat.toFixed(6),
  });
  const res = await api<{ path: GeoDrivePath | null }>(`${ApiRoutes.geoRoute}?${qs.toString()}`, {
    signal: opts.signal,
  });
  return res.path ?? null;
}

/** 关键词 → 候选地点；少于 2 个字直接空数组，不打高德也不烧配额。 */
export async function searchGeo(
  query: string,
  opts: { city?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  await bootServer();
  const qs = new URLSearchParams({ q });
  if (opts.city) qs.set("city", opts.city);
  if (opts.limit) qs.set("limit", String(opts.limit));
  const res = await api<{ items: GeoPlace[] }>(`${ApiRoutes.geoSearch}?${qs.toString()}`, {
    signal: opts.signal,
  });
  return Array.isArray(res.items) ? res.items : [];
}
