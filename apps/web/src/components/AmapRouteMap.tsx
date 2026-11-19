import { useEffect, useRef, useState } from "react";
import { fetchGeoMapConfig, fetchGeoRoute } from "@/lib/geoApi";
import { loadAmap, type AmapMap } from "@/lib/amap";

/**
 * 班车路线图：进去就能看见这条线从第一站怎么绕到公司。
 *
 * 画两层线 ——
 *   1) 站点顺序的直线（灰虚线）：只说明先后，不代表怎么走；
 *   2) 高德驾车规划（蓝实线）：按「站1→站2→…→公司」逐段真算一遍再拼起来，
 *      这才是能照着开的那条路，里程和时长也来自它。
 * 站点坐标是 GCJ-02（库里的原始数据就是高德的），所以不需要任何坐标转换。
 */

export interface MapStop {
  name: string;
  depart?: string;
  lng: number;
  lat: number;
}

export interface MapTerminal {
  name: string;
  lng: number;
  lat: number;
}

type Phase = "loading" | "ready" | "error";

function hasCoord(row: { lng: number; lat: number }): boolean {
  return Number.isFinite(row.lng) && Number.isFinite(row.lat) && (row.lng !== 0 || row.lat !== 0);
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;",
  );
}

function bubble(text: string, color: string, size = 22): string {
  const half = size / 2;
  return (
    '<div style="min-width:' + size + 'px;height:' + size + 'px;padding:0 5px;border-radius:' + half +
    'px;background:' + color + ';color:#fff;font-size:12px;font-weight:800;line-height:' + size +
    'px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff;box-sizing:border-box;font-family:inherit;white-space:nowrap">' +
    text +
    '</div>'
  );
}

/**
 * 一段驾车路径：问自家服务端 /geo/route。
 * 浏览器里的 AMap.Driving 插件走 restapi 且带 s=rsv3，这把 Key 没开签名就被拒
 * （USERKEY_PLAT_NOMATCH），所以折线一律服务端算完再画。
 */
async function planSegment(
  from: [number, number],
  to: [number, number],
): Promise<{ path: [number, number][]; distance: number; time: number } | null> {
  try {
    const leg = await fetchGeoRoute({ lng: from[0], lat: from[1] }, { lng: to[0], lat: to[1] });
    if (!leg || leg.points.length < 2) return null;
    return {
      path: leg.points.map((point) => [point.lng, point.lat] as [number, number]),
      distance: leg.distance,
      time: leg.duration,
    };
  } catch {
    return null;
  }
}

export function AmapRouteMap({
  stops,
  terminal,
  height = 340,
  title,
}: {
  stops: MapStop[];
  terminal: MapTerminal;
  height?: number;
  title?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("正在取地图 Key…");
  const [summary, setSummary] = useState<string>("");

  const located = stops.filter(hasCoord);
  const signature =
    located.map((row) => row.name + "|" + row.depart + "|" + row.lng.toFixed(5) + "," + row.lat.toFixed(5)).join(";") +
    "||" +
    terminal.lng.toFixed(5) +
    "," +
    terminal.lat.toFixed(5);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let alive = true;
    let map: AmapMap | null = null;

    setPhase("loading");
    setSummary("");
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

        const okStops = stops.filter(hasCoord);
        const anchors: [number, number][] = [
          ...okStops.map((row) => [row.lng, row.lat] as [number, number]),
          [terminal.lng, terminal.lat],
        ];
        const center = anchors.length > 0 ? anchors[Math.floor(anchors.length / 2)] : [terminal.lng, terminal.lat];

        map = new amap.Map(boxRef.current, {
          zoom: 11,
          center,
          viewMode: "2D",
          resizeEnable: true,
          mapStyle: "amap://styles/normal",
        });

        // 站点气泡：序号写进圆点，站名留在信息窗里，免得挤成一团
        okStops.forEach((row, at) => {
          const marker = new amap.Marker({
            position: [row.lng, row.lat],
            content: bubble(String(at + 1), "#0284c7"),
            offset: new amap.Pixel(-11, -32),
            zIndex: 120,
          });
          marker.on("click", () => {
            const next = okStops[at + 1];
            const tail = Number.isFinite(at) && at < okStops.length - 1 ? next.name : terminal.name;
            const info = new amap.InfoWindow({
              offset: new amap.Pixel(0, -28),
              isCustom: false,
            });
            info.setContent(
              '<div style="font-size:12.5px;line-height:1.6;font-family:inherit">' +
                '<b style="font-size:13px">第 ' +
                (at + 1) +
                " 站 · " +
                esc(row.name || "未命名") +
                "</b><br/>发车 " +
                esc(row.depart || "—") +
                "<br/>下一段 → " +
                esc(tail || "公司") +
                "</div>",
            );
            info.open(map as AmapMap, [row.lng, row.lat]);
          });
          (map as AmapMap).add(marker);
        });

        const terminalMarker = new amap.Marker({
          position: [terminal.lng, terminal.lat],
          content: bubble("公司", "#16a34a", 24),
          offset: new amap.Pixel(-22, -32),
          zIndex: 130,
        });
        (map as AmapMap).add(terminalMarker);

        // 第一层：站点顺序直线，只表示先后
        if (okStops.length >= 2) {
          const order = new amap.Polyline({
            path: [...okStops.map((row) => [row.lng, row.lat] as [number, number]), [terminal.lng, terminal.lat] as [number, number]],
            strokeColor: "#94a3b8",
            strokeWeight: 2,
            strokeOpacity: 0.85,
            strokeStyle: "dashed",
            lineJoin: "round",
            zIndex: 60,
          });
          (map as AmapMap).add(order);
        }

        // 第二层：逐段真规划，拼成能照着开的蓝色路线
        const legs: { from: [number, number]; to: [number, number] }[] = [];
        for (let at = 0; at < okStops.length; at += 1) {
          const from: [number, number] = [okStops[at].lng, okStops[at].lat];
          const to: [number, number] =
            at + 1 < okStops.length ? [okStops[at + 1].lng, okStops[at + 1].lat] : [terminal.lng, terminal.lat];
          legs.push({ from, to });
        }

        if (legs.length > 0) {
          const full: [number, number][] = [];
          let metres = 0;
          let seconds = 0;
          let failed = 0;
          for (let at = 0; at < legs.length; at += 1) {
            if (!alive) return;
            setMessage("正在规划第 " + (at + 1) + "/" + legs.length + " 段路线…");
            const leg = await planSegment(legs[at].from, legs[at].to);
            if (!leg) {
              failed += 1;
              continue;
            }
            metres += leg.distance;
            seconds += leg.time;
            for (const point of leg.path) full.push(point);
          }
          if (!alive) return;
          if (full.length >= 2) {
            const road = new amap.Polyline({
              path: full,
              strokeColor: "#2563eb",
              strokeWeight: 5,
              strokeOpacity: 0.95,
              lineJoin: "round",
              showDir: true,
              zIndex: 80,
            });
            (map as AmapMap).add(road);
          }
          const km = (metres / 1000).toFixed(1);
          const minutes = Math.round(seconds / 60);
          setSummary(
            metres > 0
              ? "驾车 " + km + " km · 约 " + minutes + " 分钟" + (failed > 0 ? "（" + failed + " 段没算出来，用直线代替）" : "")
              : "路线没算出来：起终点可能不在可驾车道路附近",
          );
        } else if (okStops.length === 0) {
          setSummary("这条线还没有带坐标的站点：先给站点点「高德定位」");
        } else {
          setSummary("只有一站，画不出线路");
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
    // signature 把坐标和站名压成一行：坐标一动就整张图重画
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, terminal.lng, terminal.lat]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div className="lb" style={{ margin: 0 }}>
          {title || "路线图"}
        </div>
        <div style={{ fontSize: 11.5, color: phase === "error" ? "#dc2626" : "var(--text-dim)" }}>
          {phase === "error" ? message : phase === "loading" ? message : summary || "已就绪"}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--glass-border-subtle)",
          background: "var(--card-inset-bg)",
        }}
      >
        <div ref={boxRef} style={{ position: "absolute", inset: 0 }} />
        {phase === "loading" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--text-dim)",
              background: "rgba(0,0,0,0.12)",
              pointerEvents: "none",
            }}
          >
            {message}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-dim)", flexWrap: "wrap" }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: "#0284c7", marginRight: 4 }} />
          上客点（按发车顺序）
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: "#16a34a", marginRight: 4 }} />
          公司终点
        </span>
        <span>
          <span style={{ display: "inline-block", width: 14, height: 3, background: "#2563eb", marginRight: 4, verticalAlign: "middle" }} />
          高德驾车路径
        </span>
        <span>
          <span style={{ display: "inline-block", width: 14, height: 0, borderTop: "2px dashed #94a3b8", marginRight: 4, verticalAlign: "middle" }} />
          站点先后
        </span>
      </div>
    </div>
  );
}
