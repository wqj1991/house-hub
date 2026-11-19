import { useEffect, useRef, useState } from "react";
import { fetchGeoMapConfig } from "@/lib/geoApi";
import { loadAmap, type AmapMap } from "@/lib/amap";

/**
 * 楼盘位置图：只回答「这盘到底在哪」，所以一个点 + 一个信息窗就够了。
 *
 * 坐标是 GCJ-02（高德坐标系）：房天下详情页给的是 BD-09，抽取脚本
 * scripts/extract-newhouse-detail.mjs 已经换算过，这里不再转，转两次反而偏。
 */

type Phase = "loading" | "ready" | "error";

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;",
  );
}

/** 图钉：底座对着坐标点，offset 让针尖落准。 */
function pin(text: string): string {
  return (
    '<div style="display:flex;align-items:center;gap:5px;padding:4px 9px 4px 5px;border-radius:14px;' +
    "background:#0284c7;color:#fff;font-size:12px;font-weight:800;line-height:16px;white-space:nowrap;" +
    'box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff;box-sizing:border-box;font-family:inherit">' +
    '<span style="font-size:12px">📍</span>' +
    esc(text) +
    "</div>"
  );
}

export function AmapSpotMap({
  name,
  address,
  lng,
  lat,
  height = 240,
}: {
  name: string;
  address?: string | null;
  lng: number;
  lat: number;
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("正在取地图 Key…");

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

        const center: [number, number] = [lng, lat];
        map = new amap.Map(boxRef.current, {
          zoom: 15,
          center,
          viewMode: "2D",
          resizeEnable: true,
          mapStyle: "amap://styles/normal",
        });

        const marker = new amap.Marker({
          position: center,
          content: pin(name),
          offset: new amap.Pixel(-14, -30),
          zIndex: 120,
        });
        (map as AmapMap).add(marker);

        const info = new amap.InfoWindow({ offset: new amap.Pixel(0, -28), isCustom: false });
        const open = () => {
          info.setContent(
            '<div style="font-size:12.5px;line-height:1.6;font-family:inherit">' +
              '<b style="font-size:13px">' +
              esc(name) +
              "</b>" +
              (address ? "<br/>" + esc(address) : "") +
              "</div>",
          );
          if (map) info.open(map, center);
        };
        marker.on("click", open);
        open();

        setPhase("ready");
      } catch (err) {
        if (!alive) return;
        setPhase("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      alive = false;
      if (map) {
        map.destroy();
        map = null;
      }
    };
  }, [name, address, lng, lat]);

  return (
    <div className="pick-map">
      <div className="pick-map-box" style={{ height }} ref={boxRef}>
        {phase === "ready" ? null : <div className="pick-map-state">{message}</div>}
      </div>
    </div>
  );
}
