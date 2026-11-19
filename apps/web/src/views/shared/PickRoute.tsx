import { useEffect, useState } from "react";
import type { OfficeLocation } from "@house/core";
import type { NewProjectDto } from "@/lib/newhouseApi";
import { fetchGeoRoute } from "@/lib/geoApi";
import type { GeoDrivePath } from "@/lib/geoApi";
import { AmapCommuteRoute } from "@/components/AmapCommuteRoute";

/**
 * 通勤路线页（/picks/<uid>/route）：点详情页地图下面那行「到公司」进来。
 *
 * 数字只有一个来源：服务端 /geo/route 的高德驾车规划（距离、时长、点串一起下发），
 * 页面上不再自己拿经纬度估时长，免得两个地方对不上。
 */

function hasCoord(office: OfficeLocation): boolean {
  return Number.isFinite(office.lng) && Number.isFinite(office.lat) && (office.lng !== 0 || office.lat !== 0);
}

function fmtKm(metres: number): string {
  return (metres / 1000).toFixed(1) + " km";
}

function fmtMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes <= 0 ? "不到 1 分钟" : "约 " + minutes + " 分钟";
}

/** "09:00" + 分钟数 → "08:32"；算不出来返回空串。 */
function clockBefore(clock: string, minutes: number): string {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!matched) return "";
  const base = Number(matched[1]) * 60 + Number(matched[2]);
  const at = base - minutes;
  if (at < 0 || at > 24 * 60) return "";
  const hh = Math.floor(at / 60);
  const mm = at % 60;
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

function amapNavHref(from: { name: string; lng: number; lat: number }, to: { name: string; lng: number; lat: number }, mode: "car" | "bus"): string {
  return (
    "https://uri.amap.com/navigation?from=" +
    from.lng + "," + from.lat + "," + encodeURIComponent(from.name) +
    "&to=" + to.lng + "," + to.lat + "," + encodeURIComponent(to.name) +
    "&mode=" + mode + "&policy=1&coordinate=gaode&callnative=1&src=house-hub"
  );
}

export function PickRoutePage({
  item,
  offices,
  preferredUid = "",
  onBack,
}: {
  item: NewProjectDto;
  offices: OfficeLocation[];
  /** 详情页那行「到公司」用的同一处：进来先看同一个终点，别两个页面各算各的 */
  preferredUid?: string;
  onBack: () => void;
}) {
  const located = offices.filter(hasCoord);
  const [officeUid, setOfficeUid] = useState(
    () => located.find((row) => row.uid === preferredUid)?.uid ?? located[0]?.uid ?? "",
  );
  const office = located.find((row) => row.uid === officeUid) ?? located[0] ?? null;

  const hasMap = typeof item.lng === "number" && typeof item.lat === "number" && (item.lng !== 0 || item.lat !== 0);
  const [path, setPath] = useState<GeoDrivePath | null | undefined>(undefined);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (!hasMap || !office) return;
    let alive = true;
    setPath(undefined);
    setFailed("");
    fetchGeoRoute({ lng: item.lng!, lat: item.lat! }, { lng: office.lng, lat: office.lat })
      .then((leg) => {
        if (alive) setPath(leg);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setPath(null);
        setFailed(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [hasMap, item.lng, item.lat, office?.uid, office?.lng, office?.lat]);

  const km = path ? fmtKm(path.distance) : "";
  const minutes = path ? fmtMinutes(path.duration) : "";
  const leaveBy = path && office ? clockBefore(office.beIn, Math.round(path.duration / 60)) : "";

  const bar = (
    <div className="pick-page-bar">
      <button type="button" className="pick-btn" onClick={onBack}>
        ← 返回楼盘详情
      </button>
      {office && hasMap ? (
        <a
          className="pick-btn"
          href={amapNavHref({ name: item.name, lng: item.lng!, lat: item.lat! }, { name: office.name, lng: office.lng, lat: office.lat }, "car")}
          target="_blank"
          rel="noreferrer"
        >
          高德导航
        </a>
      ) : null}
    </div>
  );

  if (!hasMap) {
    return (
      <div className="pick-page">
        {bar}
        <div className="card-inset pick-empty">这个盘还没抓到坐标，算不出到公司的路线。</div>
      </div>
    );
  }

  if (!office) {
    return (
      <div className="pick-page">
        {bar}
        <div className="card-inset pick-empty">
          还没录公司地点：先在「通勤档案 · 公司地点」里搜到并选中一处（要带坐标），这里才画得出路线。
        </div>
      </div>
    );
  }

  return (
    <div className="pick-page">
      {bar}

      <div className="card-inset pick-card pick-page-card">
        <div className="pick-sec-head">
          <div className="pick-sec-title">
            通勤路线
            <span className="pick-sec-count">{item.name} → {office.name}</span>
          </div>
          <div className="pick-sec-actions">
            {path ? (
              <a
                className="pick-btn"
                href={amapNavHref({ name: item.name, lng: item.lng!, lat: item.lat! }, { name: office.name, lng: office.lng, lat: office.lat }, "bus")}
                target="_blank"
                rel="noreferrer"
              >
                公交 / 地铁
              </a>
            ) : null}
          </div>
        </div>

        <div className="pick-route-stats">
          <div className="pick-route-stat">
            <span>驾车距离</span>
            <b>{path ? km : path === null ? "—" : "…"}</b>
          </div>
          <div className="pick-route-stat">
            <span>驾车时长</span>
            <b>{path ? minutes : path === null ? "—" : "…"}</b>
          </div>
          <div className="pick-route-stat">
            <span>到岗 {office.beIn || "—"}</span>
            <b>{leaveBy ? leaveBy + " 出门" : "—"}</b>
          </div>
          <div className="pick-route-stat">
            <span>终点</span>
            <b className="is-text">{office.name}</b>
          </div>
        </div>

        <AmapCommuteRoute
          from={{ name: item.name, address: item.address || item.salesAddress, lng: item.lng!, lat: item.lat! }}
          to={{ name: office.name, address: office.address, lng: office.lng, lat: office.lat }}
          path={path}
          height={360}
        />

        {failed ? (
          <div className="pick-route-note is-warn">高德路线没算出来：{failed.slice(0, 120)}</div>
        ) : path === null ? (
          <div className="pick-route-note is-warn">起终点可能不在可驾车道路附近，图上只能画直线，实际请按「高德导航」走一遍。</div>
        ) : (
          <div className="pick-route-note">
            数字来自高德驾车规划（不含停车、找车位的零碎时间）；「出门」按公司到岗时刻倒推。楼盘这头是抓取到的坐标，口径是门口附近。
          </div>
        )}

        {located.length > 1 ? (
          <div className="pick-route-offices">
            <span className="pick-sec-count">换终点公司</span>
            {located.map((row) => (
              <button
                key={row.uid}
                type="button"
                className={"pick-btn" + (row.uid === office.uid ? " is-primary" : "")}
                onClick={() => setOfficeUid(row.uid)}
              >
                {row.name || "未命名公司"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
