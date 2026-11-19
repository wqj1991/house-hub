import { Hono } from "hono";
import { ApiRoutes } from "@house/protocol";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import { AmapError, amapConfigured, drivingPath, geocodeAddress, searchPlaces } from "../amap";

/**
 * 地点检索：客户端输入公司地点时只问这一层。
 * Key 留在服务端，浏览器/手机拿不到；未配置时明说 503，而不是让页面静默失败。
 */

export interface GeoOptions {
  key: string;
  /** 默认城市：请求没带 city 时用它 */
  city: string;
}

function errorStatus(err: AmapError): 502 | 503 {
  return err.code === "amap_unconfigured" ? 503 : 502;
}

/** "116.3726,40.022" → { lng, lat }；越界和 0,0 一律当没写。 */
function parsePoint(raw: string | undefined): { lng: number; lat: number } | null {
  const [lngRaw, latRaw] = (raw ?? "").split(",");
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  if (lng === 0 && lat === 0) return null;
  return { lng, lat };
}

export function geoRoutes(db: Db, opts: GeoOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);
  const configured = amapConfigured(opts.key);

  app.get(ApiRoutes.geoStatus, auth, (c) => c.json({ configured, city: opts.city }));

  app.get(ApiRoutes.geoSearch, auth, async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    const city = (c.req.query("city") ?? "").trim() || opts.city;
    const limit = Number(c.req.query("limit") ?? "8");
    if (q.length < 2) return c.json({ items: [], configured });
    try {
      const items = await searchPlaces(opts.key, q, { city, limit: Number.isFinite(limit) ? limit : 8 });
      return c.json({ items, configured });
    } catch (err) {
      if (err instanceof AmapError) {
        return c.json({ code: err.code, message: err.message, items: [], configured }, errorStatus(err));
      }
      throw err;
    }
  });

  /**
   * 下发浏览器 JSAPI 的 Key。
   * 检索类 Key 可以只住服务端，但地图渲染是浏览器自己画的，Key 必然出现在页面里；
   * 与其让前端仓库再抄一份，不如从这里现取，换 Key 只改 services/api/.env。
   */
  app.get(ApiRoutes.geoMapConfig, auth, (c) =>
    c.json({ configured, city: opts.city, key: configured ? opts.key.trim() : "" }),
  );

  /**
   * 驾车折线：前端画「这条班车线怎么走」用。
   * 浏览器里的 AMap.Driving 插件会带 s=rsv3 打 restapi，这把 Key 没开数字签名就被
   * 回 USERKEY_PLAT_NOMATCH，所以折线由服务端算好，只把点串下发。
   */
  app.get(ApiRoutes.geoRoute, auth, async (c) => {
    const from = parsePoint(c.req.query("from"));
    const to = parsePoint(c.req.query("to"));
    if (!from || !to) {
      return c.json({ code: "bad_point", message: "from / to 要写成 lng,lat", path: null, configured }, 400);
    }
    try {
      return c.json({ path: await drivingPath(opts.key, from, to), configured });
    } catch (err) {
      if (err instanceof AmapError) {
        return c.json({ code: err.code, message: err.message, path: null, configured }, errorStatus(err));
      }
      throw err;
    }
  });

  app.get(ApiRoutes.geoGeocode, auth, async (c) => {
    const address = (c.req.query("address") ?? "").trim();
    const city = (c.req.query("city") ?? "").trim() || opts.city;
    if (!address) return c.json({ item: null, configured });
    try {
      return c.json({ item: await geocodeAddress(opts.key, address, { city }), configured });
    } catch (err) {
      if (err instanceof AmapError) {
        return c.json({ code: err.code, message: err.message, item: null, configured }, errorStatus(err));
      }
      throw err;
    }
  });

  return app;
}
