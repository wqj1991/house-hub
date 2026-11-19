import { useEffect, useState } from "react";
import {
  COMMUTE_ROUTE_MODE_LABEL,
  COMMUTE_ROUTE_MODE_ORDER,
  COMMUTE_VEHICLE_LABEL,
  SHUTTLE_SEAT_LABEL,
  commuteOverview,
  commuteRouteMode,
  defaultHabit,
  formatClock,
  habitForOffice,
  habitOffice,
  parseClock,
} from "@house/core";
import type { CommuteHabit, OfficeLocation, ShuttleBinding } from "@house/core";
import type { NewProjectDto } from "@/lib/newhouseApi";
import { fetchGeoRoute } from "@/lib/geoApi";
import type { GeoRoutePath } from "@/lib/geoApi";
import { fetchShuttlePlan, loadShuttleLib } from "@/lib/shuttleLib";
import type { ShuttleLineView, ShuttlePlanView } from "@/lib/shuttleLib";
import { AmapCommuteRoute } from "@/components/AmapCommuteRoute";
import { AmapRouteMap } from "@/components/AmapRouteMap";

/**
 * 通勤路线页（/picks/<uid>/route）：点详情页地图下面那行「到公司」进来。
 *
 * 按「默认通勤习惯」画：
 * - 终点 = 习惯指向的公司（没指定就取第一处有坐标的）；
 * - 走法 = 习惯的 vehicle（公交地铁 / 自驾 / 步行 / 电动车），可以临时换着看；
 * - 时刻 = 习惯的出门、到岗，跟档案里同一口径，不在页面上另算一套。
 * 数字只有一个来源：服务端 /geo/route 的高德规划（距离、时长、点串一起下发）。
 * 班车没有连续折线，按线路库的站点顺序单独画一张，上面仍给驾车里程做对照。
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

/** "HH:mm" 前后挪分钟数；算不出来返回空串。时刻口径全走 core 的 parseClock/formatClock。 */
function clockShift(clock: string, minutes: number): string {
  const base = parseClock(clock);
  return base === null ? "" : formatClock(base + minutes);
}

function clockBefore(clock: string, minutes: number): string {
  return clockShift(clock, -minutes);
}

function amapNavHref(
  from: { name: string; lng: number; lat: number },
  to: { name: string; lng: number; lat: number },
  mode: "car" | "bus" | "walk" | "ride",
): string {
  return (
    "https://uri.amap.com/navigation?from=" +
    from.lng + "," + from.lat + "," + encodeURIComponent(from.name) +
    "&to=" + to.lng + "," + to.lat + "," + encodeURIComponent(to.name) +
    "&mode=" + mode + "&policy=1&coordinate=gaode&callnative=1&src=house-hub"
  );
}

/** 画线走法 → 高德 URI 的 mode。 */
const NAV_MODE: Record<"drive" | "transit" | "walk" | "bike", "car" | "bus" | "walk" | "ride"> = {
  drive: "car",
  transit: "bus",
  walk: "walk",
  bike: "ride",
};

export function PickRoutePage({
  item,
  offices,
  habits = [],
  shuttles = [],
  preferredUid = "",
  onBack,
}: {
  item: NewProjectDto;
  offices: OfficeLocation[];
  /** 通勤习惯：默认那条决定走法与时刻，其它条只用来给「换公司」找对应习惯 */
  habits?: CommuteHabit[];
  /** 班车归属：习惯是班车时用它在公司下面找线路号 */
  shuttles?: ShuttleBinding[];
  /** 详情页那行「到公司」用的同一处：进来先看同一个终点，别两个页面各算各的 */
  preferredUid?: string;
  onBack: () => void;
}) {
  const located = offices.filter(hasCoord);
  const primary = defaultHabit(habits);
  const habitFor = (target: OfficeLocation | null): CommuteHabit | null =>
    target ? habitForOffice(habits, target.uid) : null;

  const seededUid = [preferredUid, habitOffice(primary, offices)?.uid ?? "", located[0]?.uid ?? ""].find(
    (uid) => uid !== "" && located.some((row) => row.uid === uid),
  ) ?? "";
  const [officeUid, setOfficeUid] = useState(seededUid);
  const office = located.find((row) => row.uid === officeUid) ?? located[0] ?? null;

  const habit = habitFor(office);
  const [mode, setMode] = useState(() => commuteRouteMode(habitFor(office)?.vehicle ?? "drive"));

  const overview = commuteOverview({ offices, habits, shuttles });
  const habitView = habit ? overview.views.find((view) => view.habit.uid === habit.uid) ?? null : null;

  const hasMap = typeof item.lng === "number" && typeof item.lat === "number" && (item.lng !== 0 || item.lat !== 0);
  // 班车习惯要的是「骑行 + 班车」，跑一条驾车折线既费配额又误导人
  const isShuttle = habit?.vehicle === "shuttle";
  const [path, setPath] = useState<GeoRoutePath | null | undefined>(undefined);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (!hasMap || !office || isShuttle) return;
    let alive = true;
    setPath(undefined);
    setFailed("");
    fetchGeoRoute({ lng: item.lng!, lat: item.lat! }, { lng: office.lng, lat: office.lat }, { mode })
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
  }, [hasMap, item.lng, item.lat, office?.uid, office?.lng, office?.lat, mode, isShuttle]);

  // 班车习惯：线路本体在服务端 line / stop，把挂在这处公司的线路都取回来
  const boundCodes =
    habit?.vehicle === "shuttle"
      ? Array.from(new Set(shuttles.filter((row) => row.officeUid === office?.uid).map((row) => row.code.toUpperCase())))
      : [];
  const boundSig = boundCodes.join(",");
  const [shuttleLines, setShuttleLines] = useState<ShuttleLineView[]>([]);
  const [shuttlePhase, setShuttlePhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [pickedCode, setPickedCode] = useState("");

  useEffect(() => {
    if (!boundSig) {
      setShuttleLines([]);
      setShuttlePhase("idle");
      return;
    }
    let alive = true;
    setShuttlePhase("loading");
    void loadShuttleLib().then((lib) => {
      if (!alive) return;
      if (!lib) {
        setShuttlePhase("error");
        return;
      }
      const wanted = boundSig.split(",");
      setShuttleLines(lib.lines.filter((row) => wanted.includes(row.code)));
      setShuttlePhase("ready");
    });
    return () => {
      alive = false;
    };
  }, [boundSig]);

  // 习惯里写了线路名就按名字认一条；没写就等服务端算完再落到它挑的那条
  const habitLine = (habit?.shuttle?.line ?? "").trim();
  const guessedCode = habitLine
    ? shuttleLines.find(
        (row) =>
          row.code.toLowerCase() === habitLine.toLowerCase() ||
          (row.name.length > 1 && (habitLine.includes(row.name) || row.name.includes(habitLine))),
      )?.code ?? ""
    : "";

  // 骑行 + 班车的整条走法：时间、折线、倒推的出门时刻都由服务端算
  const [plan, setPlan] = useState<ShuttlePlanView | null | undefined>(undefined);
  const [planError, setPlanError] = useState("");
  useEffect(() => {
    if (!isShuttle || !hasMap || !office) {
      setPlan(undefined);
      setPlanError("");
      return;
    }
    let alive = true;
    setPlan(undefined);
    setPlanError("");
    fetchShuttlePlan(
      { lng: item.lng!, lat: item.lat! },
      { officeUid: office.uid, code: pickedCode || undefined },
    )
      .then((res) => {
        if (alive) setPlan(res.plan);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setPlan(null);
        setPlanError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [isShuttle, hasMap, item.lng, item.lat, office?.uid, pickedCode]);

  const activeCode = pickedCode || plan?.code || guessedCode || boundCodes[0] || "";
  const shuttleLine = shuttleLines.find((row) => row.code === activeCode) ?? null;

  // 班车走法的倒推时刻：出门 = 发车 − 骑行；到岗 = 班车到公司时刻
  const shuttleSlack = (() => {
    if (!plan || !office) return null;
    const beIn = parseClock(office.beIn);
    const arrive = parseClock(plan.arrive);
    return beIn !== null && arrive !== null ? beIn - arrive : null;
  })();

  const pathMinutes = path ? Math.round(path.duration / 60) : null;
  const leaveBy = isShuttle
    ? plan?.leaveHome ?? habit?.departHome ?? ""
    : habit?.departHome || (path && office ? clockBefore(office.beIn, pathMinutes ?? 0) : "");
  const arriveAt = isShuttle
    ? plan?.arrive ?? office?.beIn ?? ""
    : habit?.arriveWork ||
      habitView?.computedArrive ||
      (leaveBy && pathMinutes !== null ? clockShift(leaveBy, pathMinutes) : "");
  const slack = isShuttle ? shuttleSlack : habitView?.slackMin ?? null;

  function chooseOffice(uid: string): void {
    setOfficeUid(uid);
    const next = habitFor(located.find((row) => row.uid === uid) ?? null);
    if (next) setMode(commuteRouteMode(next.vehicle));
  }

  const bar = (
    <div className="pick-page-bar">
      <button type="button" className="pick-btn" onClick={onBack}>
        ← 返回楼盘详情
      </button>
      {office && hasMap ? (
        <a
          className="pick-btn"
          href={
            isShuttle && plan
              ? amapNavHref(
                  { name: item.name, lng: item.lng!, lat: item.lat! },
                  { name: plan.stop.name, lng: plan.stop.lng, lat: plan.stop.lat },
                  "ride",
                )
              : amapNavHref(
                  { name: item.name, lng: item.lng!, lat: item.lat! },
                  { name: office.name, lng: office.lng, lat: office.lat },
                  NAV_MODE[mode],
                )
          }
          target="_blank"
          rel="noreferrer"
        >
          {isShuttle && plan ? "骑行导航到站点" : "高德导航"}
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

  // 班车习惯的卡片：默认走法就是它，所以摆在「其它走法」前面
  const shuttleCard =
    habit?.vehicle === "shuttle" ? (
      <div className="card-inset" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <b style={{ fontSize: 13.5 }}>默认习惯 · 班车</b>
          <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
            {boundCodes.length ? "站点顺序来自线路库" : "这处公司还没挂线路"}
          </span>
        </div>
        {boundCodes.length > 1 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {boundCodes.map((code) => {
              const row = shuttleLines.find((line) => line.code === code);
              return (
                <button
                  key={code}
                  type="button"
                  className={"pick-btn" + (code === activeCode ? " is-primary" : "")}
                  onClick={() => setPickedCode(code)}
                >
                  {code}
                  {row?.name ? " " + row.name : ""}
                </button>
              );
            })}
          </div>
        ) : null}
        {shuttleLine ? (
          <>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
              {shuttleLine.code} {shuttleLine.name}
              {shuttleLine.arrive ? " · " + shuttleLine.arrive + " 到公司" : ""}
              {shuttleLine.stops[0]?.depart ? " · 首站 " + shuttleLine.stops[0].depart + " 发车" : ""}
            </div>
            <AmapRouteMap
              key={shuttleLine.code}
              stops={shuttleLine.stops.map((stop) => ({
                name: stop.name,
                depart: stop.depart,
                lng: stop.lng,
                lat: stop.lat,
              }))}
              terminal={{ name: office.name, lng: office.lng, lat: office.lat }}
              title={shuttleLine.code + " " + shuttleLine.name}
              height={300}
            />
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
            {!boundCodes.length
              ? "去「通勤档案 · 班车线路」把这处公司挂上一条线，这里就能画出班车从首站到公司的走法。"
              : shuttlePhase === "loading"
                ? "正在读线路站点…"
                : shuttlePhase === "error"
                  ? "线路没读出来：检查服务器连接后重新进这个页面。"
                  : "线路库里找不到 " + boundCodes.join(" / ") + "：可能已被删掉，去「班车线路」重挂一条。"}
          </div>
        )}
      </div>
    ) : null;

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
            <a
              className="pick-btn"
              href={
                isShuttle && plan
                  ? amapNavHref(
                      { name: item.name, lng: item.lng!, lat: item.lat! },
                      { name: plan.stop.name, lng: plan.stop.lng, lat: plan.stop.lat },
                      "ride",
                    )
                  : amapNavHref(
                      { name: item.name, lng: item.lng!, lat: item.lat! },
                      { name: office.name, lng: office.lng, lat: office.lat },
                      NAV_MODE[mode],
                    )
              }
              target="_blank"
              rel="noreferrer"
            >
              {isShuttle && plan ? "骑行到站点 · 导航" : "按习惯导航"}
            </a>
          </div>
        </div>

        {habit ? (
          <div className="card-inset" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="me-setting-pill" style={{ fontSize: 11 }}>
                {habit.uid === primary?.uid ? "默认习惯" : "这处公司的习惯"}
              </span>
              <b style={{ fontSize: 14 }}>
                {COMMUTE_VEHICLE_LABEL[habit.vehicle]}
                {habit.label ? " · " + habit.label : ""}
              </b>
              <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                每周 {habit.daysPerWeek} 天 · 家 → 公司
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
              {isShuttle
                ? plan
                  ? "骑行 " + plan.accessMinutes + " 分 + 班车 " + plan.rideMinutes + " 分 = 全程 " + plan.totalMinutes + " 分"
                  : "正在按最近的上客点算骑行 + 班车的时长"
                : path
                  ? COMMUTE_ROUTE_MODE_LABEL[mode] + " " + fmtMinutes(path.duration) + "（按路线实算）"
                  : habit.minutes > 0
                    ? "档案单程 " + habit.minutes + " 分钟"
                    : "单程时长正在算"}
              {arriveAt ? " · " + arriveAt + " 到岗" : ""}
              {slack !== null
                ? slack >= 0
                  ? " · 到岗早 " + slack + " 分"
                  : " · 迟到 " + Math.abs(slack) + " 分"
                : ""}
            </div>
            {habit.shuttle ? (
              <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                班车 {habit.shuttle.line || "未填线路"}
                {habit.shuttle.stop ? " · " + habit.shuttle.stop + " 上车" : ""}
                {habit.shuttle.depart ? " · " + habit.shuttle.depart + " 发车" : ""}
                {habit.shuttle.arrive ? " · " + habit.shuttle.arrive + " 到公司" : ""}
                {habit.shuttle.lastReturn ? " · 末班返程 " + habit.shuttle.lastReturn : ""}
                {" · " + SHUTTLE_SEAT_LABEL[habit.shuttle.seat]}
              </div>
            ) : null}
            {habitView && habitView.warnings.length > 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--text-sub)", lineHeight: 1.6 }}>
                {habitView.warnings.map((warning) => (
                  <div key={warning}>· {warning}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="pick-route-note">
            这处公司还没挂通勤习惯：这张图先按驾车画。去「通勤档案」录一条主用习惯，下次进来终点、走法、出门与到岗都跟习惯走。
          </div>
        )}

        {isShuttle ? (
          <>
            {shuttleCard}

            <div className="pick-route-stats">
              <div className="pick-route-stat">
                <span>出门（骑行前）</span>
                <b>{leaveBy || "…"}</b>
              </div>
              <div className="pick-route-stat">
                <span>接驳骑行</span>
                <b>{plan ? plan.accessMinutes + " 分钟" : "…"}</b>
              </div>
              <div className="pick-route-stat">
                <span>班车</span>
                <b className="is-text">{plan ? plan.code + " · " + plan.stop.depart + " 发车" : "…"}</b>
              </div>
              <div className="pick-route-stat">
                <span>到岗 {office.beIn || "—"}</span>
                <b className={shuttleSlack !== null && shuttleSlack < 0 ? "coral" : undefined}>
                  {plan ? plan.arrive : "…"}
                  {shuttleSlack !== null
                    ? shuttleSlack >= 0
                      ? " · 早 " + shuttleSlack + " 分"
                      : " · 迟到 " + Math.abs(shuttleSlack) + " 分"
                    : ""}
                </b>
              </div>
            </div>

            {plan ? (
              <>
                <div className="pick-sec-head" style={{ marginTop: 4 }}>
                  <div className="pick-sec-title">
                    接驳 · 骑行到 {plan.stop.name}
                    <span className="pick-sec-count">
                      {fmtKm(plan.access.distance)} · {plan.accessMinutes} 分钟
                    </span>
                  </div>
                </div>
                <AmapCommuteRoute
                  from={{ name: item.name, address: item.address || item.salesAddress, lng: item.lng!, lat: item.lat! }}
                  to={{
                    name: plan.stop.name,
                    address: plan.stop.depart + " 发车",
                    lng: plan.stop.lng,
                    lat: plan.stop.lat,
                  }}
                  path={{
                    mode: "bike",
                    distance: plan.access.distance,
                    duration: plan.access.duration,
                    points: plan.access.points,
                    lines: [],
                  }}
                  mode="bike"
                  height={300}
                />
                <div className="pick-route-note">
                  {plan.leaveHome} 出门，骑行 {plan.accessMinutes} 分钟（{fmtKm(plan.access.distance)}）到「{plan.stop.name}」，
                  {plan.stop.depart} 上 {plan.code} {plan.name}，{plan.arrive} 到公司；全程 {plan.totalMinutes} 分钟
                  （比了最近的 {plan.considered} 个上客点，取最快的一条）。
                </div>
              </>
            ) : plan === null ? (
              <div className="pick-route-note is-warn">
                {planError
                  ? "班车接驳没算出来：" + planError.slice(0, 120)
                  : "最近的上客点都算不出骑行路线：确认公司已挂线路、站点有坐标，再试一次。"}
              </div>
            ) : (
              <div className="pick-route-note">正在从最近的几个上客点里挑最快的一条（骑行 + 班车）…</div>
            )}
          </>
        ) : (
          <>
            <div className="pick-route-offices" style={{ marginTop: 4 }}>
              <span className="pick-sec-count">走法</span>
              {COMMUTE_ROUTE_MODE_ORDER.map((row) => (
                <button
                  key={row}
                  type="button"
                  className={"pick-btn" + (row === mode ? " is-primary" : "")}
                  onClick={() => setMode(row)}
                  title={
                    habit && row === commuteRouteMode(habit.vehicle)
                      ? "默认通勤习惯用的走法"
                      : COMMUTE_ROUTE_MODE_LABEL[row]
                  }
                >
                  {COMMUTE_ROUTE_MODE_LABEL[row]}
                  {habit && row === commuteRouteMode(habit.vehicle) ? " · 习惯" : ""}
                </button>
              ))}
            </div>

            <div className="pick-route-stats">
              <div className="pick-route-stat">
                <span>{COMMUTE_ROUTE_MODE_LABEL[mode]}距离</span>
                <b>{path ? fmtKm(path.distance) : path === null ? "—" : "…"}</b>
              </div>
              <div className="pick-route-stat">
                <span>{COMMUTE_ROUTE_MODE_LABEL[mode]}时长</span>
                <b>{path ? fmtMinutes(path.duration) : path === null ? "—" : "…"}</b>
              </div>
              <div className="pick-route-stat">
                <span>{habit?.departHome ? "出门（习惯）" : "出门（按到岗 " + (office.beIn || "—") + " 倒推）"}</span>
                <b>{leaveBy || "—"}</b>
              </div>
              <div className="pick-route-stat">
                <span>到岗</span>
                <b className={slack !== null && slack < 0 ? "coral" : undefined}>{arriveAt || office.beIn || "—"}</b>
              </div>
            </div>

            <AmapCommuteRoute
              from={{ name: item.name, address: item.address || item.salesAddress, lng: item.lng!, lat: item.lat! }}
              to={{ name: office.name, address: office.address, lng: office.lng, lat: office.lat }}
              path={path}
              mode={mode}
              height={360}
            />

            {failed ? (
              <div className="pick-route-note is-warn">高德路线没算出来：{failed.slice(0, 120)}</div>
            ) : path === null ? (
              <div className="pick-route-note is-warn">
                起终点可能不在可通行道路附近，图上只能画直线；按上面的「高德导航」实际走一遍更准。
              </div>
            ) : path && path.lines?.length ? (
              <div className="pick-route-note">
                {path.lines.join(" → ")}；数字来自高德「{COMMUTE_ROUTE_MODE_LABEL[mode]}」规划，不含等车与步行找路的零碎时间。
              </div>
            ) : (
              <div className="pick-route-note">
                数字来自高德「{COMMUTE_ROUTE_MODE_LABEL[mode]}」规划（不含停车、找车位的零碎时间）；「出门」按公司到岗时刻倒推。楼盘这头是抓取到的坐标，口径是门口附近。
              </div>
            )}
          </>
        )}

        {located.length > 1 ? (
          <div className="pick-route-offices">
            <span className="pick-sec-count">换终点公司</span>
            {located.map((row) => (
              <button
                key={row.uid}
                type="button"
                className={"pick-btn" + (row.uid === office.uid ? " is-primary" : "")}
                onClick={() => chooseOffice(row.uid)}
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
