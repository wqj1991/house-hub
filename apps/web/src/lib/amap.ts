/**
 * 高德 JS API 2.0 的极简加载器：一个 script 标签、一份幂等的 Promise。
 *
 * 为什么不用 @amap/amap-jsapi-loader：仓库前端依赖一只手数得过来，
 * 而官方 loader 干的事就是插 script + 等 AMap 出现，自己写三十行更可控，
 * 出错时还能把「Key 没配 / 网络被拦 / 插件没下来」分开说清楚。
 *
 * 实测（2026-11-18，本机）：system proxy 走 127.0.0.1:17890 时
 * webapi.amap.com / jsapi.amap.com / o4.amap.com 全部 200，地图能正常渲染；
 * 公司的 Zscaler 只拦浏览器直连，走代理就通 —— 所以失败提示直接点它。
 */

/** 只声明本项目用得到的那几个类，别的交给 any。 */
export interface AmapPoint {
  getLng(): number;
  getLat(): number;
  lng: number;
  lat: number;
}

export interface AmapMap {
  add(overlay: unknown | unknown[]): void;
  remove(overlay: unknown | unknown[]): void;
  clearMap(): void;
  setFitView(overlays?: unknown[], immediately?: boolean, avoid?: number[]): void;
  setZoomAndCenter(zoom: number, center: [number, number]): void;
  on(event: string, handler: () => void): void;
  destroy(): void;
}

export interface AmapMarker {
  on(event: string, handler: () => void): void;
  getPosition(): AmapPoint;
  setMap(map: AmapMap | null): void;
}

export interface AmapPolyline {
  setMap(map: AmapMap | null): void;
}

export interface AmapInfoWindow {
  setContent(content: string): void;
  open(map: AmapMap, position: [number, number]): void;
  close(): void;
}

export interface AmapNS {
  Map: new (container: HTMLElement, opts: Record<string, unknown>) => AmapMap;
  Marker: new (opts: Record<string, unknown>) => AmapMarker;
  Polyline: new (opts: Record<string, unknown>) => AmapPolyline;
  InfoWindow: new (opts?: Record<string, unknown>) => AmapInfoWindow;
  Pixel: new (x: number, y: number) => unknown;
}

const SCRIPT_ID = "amap-jsapi-2.0";

let pending: Promise<AmapNS> | null = null;

function existing(): AmapNS | null {
  const amap = (globalThis as { AMap?: AmapNS }).AMap;
  return amap && typeof amap.Map === "function" ? amap : null;
}

/**
 * 加载 JSAPI 2.0。只装底图 + 比例尺 + 工具条，不装 AMap.Driving：
 * 那个插件会带 s=rsv3 打 restapi，这把 Key 没开签名就被回 USERKEY_PLAT_NOMATCH，
 * 折线改由服务端 /geo/route 算好下发（见 apps/web/src/lib/geoApi.ts fetchGeoRoute）。
 * key 从服务端 /geo/map-config 现取，不写死在前端仓库里。
 */
export function loadAmap(key: string): Promise<AmapNS> {
  const ready = existing();
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;

  pending = new Promise<AmapNS>((resolve, reject) => {
    const done = (amap: AmapNS) => resolve(amap);
    const fail = (message: string) => {
      pending = null;
      reject(new Error(message));
    };

    const prior = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (prior) {
      // 上一次已经把标签插进去了（热更新 / 二次进入）：只等它 onload
      prior.addEventListener("load", () => {
        const amap = existing();
        if (amap) done(amap);
        else fail("高德脚本已加载但 AMap 没挂到 window 上");
      });
      prior.addEventListener("error", () => fail("高德脚本加载失败"));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src =
      "https://webapi.amap.com/maps?v=2.0&key=" +
      encodeURIComponent(key) +
      "&plugin=AMap.Scale,AMap.ToolBar";
    script.onload = () => {
      const amap = existing();
      if (amap) done(amap);
      else fail("高德脚本回来了但 AMap 没挂到 window 上（Key 被禁或域名白名单不匹配）");
    };
    script.onerror = () => fail("下载不到 webapi.amap.com/maps（公司网可能把它拦了，浏览器要走系统代理）");
    document.head.appendChild(script);
  });

  return pending;
}
