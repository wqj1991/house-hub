import { useEffect, useRef, useState } from "react";
import { fetchGeoMapConfig } from "@/lib/geoApi";
import type { GeoRouteMode, GeoRoutePath } from "@/lib/geoApi";
import { loadAmap, type AmapMap } from "@/lib/amap";

/**
 * 两点通勤路线图：楼盘 → 公司。
 *
 * 折线不在这里算：/geo/route 按走法（驾车 / 公交 / 步行 / 骑行）由服务端调高德，
 * 把 GCJ-02 点串下发（浏览器里的 AMap.Driving 会带 s=rsv3 打 restapi，这把 Key
 * 没开签名必被拒）。path 传 undefined 表示还在算，null 表示算不出来，
 * 两种情况都给出说得清的提示；mode 只决定线的颜色和虚实。
 */

export interface CommutePoint {
  name: string;
  address?: string | null;
  lng: number;
  lat: number;
}

type Phase = "loading" | "ready" | "error";

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;",
  );
}

/** 起点 / 终点气泡：底座对着坐标点。 */
function bubble(text: string, bg: string, size = 24): string {
  const half = size / 2;
  return (
    '<div style="min-width:' + size + 'px;height:' + size + 'px;padding:0 6px;border-radius:' + half +
    'px;background:' + bg + ';color:#fff;font-size:12px;font-weight:800;line-height:' + size +
    'px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff;' +
    'box-sizing:border-box;font-family:inherit;white-space:nowrap">' + text + "</div>"
  );
}

/** 走法 → 折线样式：步行虚线、骑行紫实线、公交蓝、驾车深蓝。 */
const ROUTE_STYLE: Record<GeoRouteMode, { color: string; weight: number; dashed: boolean }> = {
  drive: { color: "#2563eb", weight: 5, dashed: false },
  transit: { color: "#0284c7", weight: 5, dashed: false },
  walk: { color: "#16a34a", weight: 4, dashed: true },
  bike: { color: "#7c3aed", weight: 4, dashed: false },
};

export function AmapCommuteRoute({
  from,
  to,
  path,
  mode = "drive",
  height = 320,
}: {
  from: CommutePoint;
  to: CommutePoint;
  /** undefined = 正在算，null = 没算出来 */
  path: GeoRoutePath | null | undefined;
  /** 习惯用哪种走法：只影响线色和虚实，点串一律来自服务端 */
  mode?: GeoRouteMode;
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("正在取地图 Key…");
  const points = path ? path.points : null;
  // 点串压成签名：路线一变就整张图重画
  const shape = points ? points.length + ":" + points[0].lng.toFixed(4) + "," + points[0].lat.toFixed(4) + ":" +
    points[points.length - 1].lng.toFixed(4) + "," + points[points.length - 1].lat.toFixed(4) : path === null ? "none" : "wait";

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let alive = true;
    let map: AmapMap | null = null;

    setPhase("loading");
    setMessage("正在取地图 Key…");

    void (async () => {
      try {
        const cfg = await fetchGeoMapConfig();
        if (!alive) return;
        if (!cfg.configured || !cfg.key) {
          setPhase("error");
          setMessage("服务端还没配高德 Key：services/api/.env 里补 HOUSE_AMAP_KEY 后重启 house-api");
          return;
        }
        setMessage("正在加载高德 JS API…");
        const amap = await loadAmap(cfg.key);
        if (!alive || !boxRef.current) return;

        map = new amap.Map(boxRef.current, {
          zoom: 11,
          center: [(from.lng + to.lng) / 2, (from.lat + to.lat) / 2],
          viewMode: "2D",
          resizeEnable: true,
          mapStyle: "amap://styles/normal",
        });

        const head = new amap.Marker({
          position: [from.lng, from.lat],
          content: bubble("起", "#0284c7"),
          offset: new amap.Pixel(-14, -30),
          zIndex: 120,
        });
        const tail = new amap.Marker({
          position: [to.lng, to.lat],
          content: bubble("终", "#16a34a"),
          offset: new amap.Pixel(-14, -30),
          zIndex: 130,
        });
        (map as AmapMap).add(head);
        (map as AmapMap).add(tail);

        const openAt = (point: CommutePoint, label: string) => () => {
          const info = new amap.InfoWindow({ offset: new amap.Pixel(0, -28), isCustom: false });
          info.setContent(
            '<div style="font-size:12.5px;line-height:1.6;font-family:inherit">' +
              '<b style="font-size:13px">' + label + " · " + esc(point.name) + "</b>" +
              (point.address ? "<br/>" + esc(point.address) : "") +
              "</div>",
          );
          if (map) info.open(map, [point.lng, point.lat]);
        };
        head.on("click", openAt(from, "起点"));
        tail.on("click", openAt(to, "终点"));

        if (points && points.length >= 2) {
          const style = ROUTE_STYLE[mode] ?? ROUTE_STYLE.drive;
          const road = new amap.Polyline({
            path: points.map((point) => [point.lng, point.lat] as [number, number]),
            strokeColor: style.color,
            strokeWeight: style.weight,
            strokeOpacity: 0.95,
            strokeStyle: style.dashed ? "dashed" : "solid",
            lineJoin: "round",
            showDir: style.dashed ? false : true,
            zIndex: 80,
          });
          (map as AmapMap).add(road);
        } else if (path === null) {
          // 算不出驾车路线时退回直线：至少让人看清两点相对位置
          const line = new amap.Polyline({
            path: [[from.lng, from.lat], [to.lng, to.lat]],
            strokeColor: "#94a3b8",
            strokeWeight: 2,
            strokeOpacity: 0.9,
            strokeStyle: "dashed",
            zIndex: 70,
          });
          (map as AmapMap).add(line);
        }

        (map as AmapMap).setFitView(undefined, false, [40, 40, 40, 40]);
        setPhase("ready");
      } catch (err) {
        if (!alive) return;
        setPhase("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      alive = false;
      try {
        map?.destroy();
      } catch {
        /* 已经销毁过 */
      }
      map = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share_key(from.lng), share_key(from.lat), share_key(to.lng), share_key(to.lat), shape, mode]);

  return (
    <div className="pick-map">
      <div className="pick-map-box" style={{ height }} ref={boxRef}>
        {phase === "ready" ? null : <div className="pick-map-state">{message}</div>}
      </div>
    </div>
  );
}

function share_key(value: number): string {
  return value.toFixed(6);
}
