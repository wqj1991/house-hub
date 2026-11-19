import { useEffect, useState } from "react";
import type { CommuteHabit, OfficeLocation } from "@house/core";
import { fetchNewProject } from "@/lib/newhouseApi";
import type { NewProjectDto } from "@/lib/newhouseApi";
import { fmtAvg, fmtPhone, fmtStamp, statusClass } from "@/lib/newhouseFormat";
import { loadCommute, useCommuteState } from "@/lib/commuteState";
import { fetchGeoRoute } from "@/lib/geoApi";
import type { GeoDrivePath } from "@/lib/geoApi";
import { AmapSpotMap } from "@/components/AmapSpotMap";
import { FloorPlanGallery } from "@/components/FloorPlanGallery";
import { PickRoutePage } from "@/views/shared/PickRoute";

/**
 * 新房详情页：桌面和手机同一份实现、同一个地址（/picks/<uid>）。
 * 端上的差别只在容器宽度，交互（进入、返回、电话、源页）完全一致。
 */

/** 从地址栏取详情 uid：/picks/<uid>；没有就回列表。 */
export function hashPickUid(): string | null {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/");
  return parts[0] === "picks" && parts[1] ? decodeURIComponent(parts[1]) : null;
}

/** 进入详情：两端都走 hash，刷新与返回键行为一致。 */
export function openPickDetail(uid: string): void {
  window.location.hash = "/picks/" + uid;
}

/** 回到选房列表。 */
export function closePickDetail(): void {
  window.location.hash = "/picks";
}

/** 详情页的子页面：/picks/<uid>/route 是通勤路线页，空串就是详情本身。 */
export function hashPickSub(): string {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/");
  if (parts[0] !== "picks") return "";
  return parts[2] ? decodeURIComponent(parts[2]) : "";
}

/** 进通勤路线页：地址栏留痕，浏览器返回键直接回详情；可指定先看哪处公司。 */
export function openPickRoute(uid: string, officeUid = ""): void {
  window.location.hash = "/picks/" + uid + "/route" + (officeUid ? "/" + officeUid : "");
}

/** 路线页要预选的公司地点：/picks/<uid>/route/<officeUid>，没写就用默认那处。 */
export function hashPickOffice(): string {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/");
  if (parts[0] !== "picks" || parts[2] !== "route") return "";
  return parts[3] ? decodeURIComponent(parts[3]) : "";
}

/** 有坐标才算数：0,0 是没落到点。 */
function hasPoint(row: { lng: number; lat: number }): boolean {
  return Number.isFinite(row.lng) && Number.isFinite(row.lat) && (row.lng !== 0 || row.lat !== 0);
}

/**
 * 算哪一处公司：主用通勤习惯指向的 > 班车线路挂着的 > 第一处有坐标的。
 * 习惯为空时班车归属才是真实意图（多条班车只通一个园区），别拿列表第一处充数。
 */
function pickOffice(offices: OfficeLocation[], habits: CommuteHabit[], shuttles: { officeUid: string }[]): OfficeLocation | null {
  const tryUid = (uid: string) => (uid ? offices.find((row) => row.uid === uid) ?? null : null);
  const primary = habits.find((row) => row.primary) ?? habits[0] ?? null;
  const byHabit = tryUid(primary?.officeUid ?? "");
  if (byHabit) return byHabit;
  for (const row of shuttles) {
    const bound = tryUid(row.officeUid);
    if (bound) return bound;
  }
  return offices.find((row) => row.lng !== 0 || row.lat !== 0) ?? offices[0] ?? null;
}

export function NewProjectDetail({ uid, onBack }: { uid: string; onBack: () => void }) {
  const [item, setItem] = useState<NewProjectDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 封面：优先本地快照（/covers/<uid>.jpg，房天下图片域名本机直连不通），失败再退远程，再退占位
  const [coverStage, setCoverStage] = useState(0);
  useEffect(() => setCoverStage(0), [uid]);

  // 子页面：/picks/<uid>/route 是通勤路线页；地址栏就是唯一状态，刷新和返回键都成立
  const [sub, setSub] = useState(() => hashPickSub());
  useEffect(() => {
    const sync = () => setSub(hashPickSub());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => setSub(hashPickSub()), [uid]);

  // 公司地点：配了几处就列几处；主用通勤习惯指向的那处排最前并标「默认」
  const commute = useCommuteState();
  useEffect(() => {
    void loadCommute();
  }, []);
  const office = pickOffice(commute.offices, commute.habits, commute.shuttles);
  const locatedOffices = commute.offices.filter(hasPoint);
  const primaryHabit = commute.habits.find((row) => row.primary) ?? null;
  const defaultUid =
    primaryHabit?.officeUid && locatedOffices.some((row) => row.uid === primaryHabit.officeUid)
      ? primaryHabit.officeUid
      : "";
  const officeOrder = defaultUid
    ? [...locatedOffices].sort((a, b) => (a.uid === defaultUid ? -1 : b.uid === defaultUid ? 1 : 0))
    : locatedOffices;
  const officeSig = officeOrder.map((row) => row.uid + ":" + row.lng + "," + row.lat).join("|");
  // 每处公司各一条驾车路线：同一把口径 /geo/route，路线页复用同一组参数
  const [legs, setLegs] = useState<Record<string, GeoDrivePath | null | undefined>>({});

  useEffect(() => {
    let alive = true;
    setItem(null);
    setError(null);
    fetchNewProject(uid)
      .then((res) => {
        if (alive) setItem(res);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    const projectHasPoint =
      item !== null && typeof item.lng === "number" && typeof item.lat === "number" && (item.lng !== 0 || item.lat !== 0);
    if (!item || !projectHasPoint || !officeOrder.length) {
      setLegs({});
      return;
    }
    let alive = true;
    const from = { lng: item.lng!, lat: item.lat! };
    setLegs(Object.fromEntries(officeOrder.map((row) => [row.uid, undefined])));
    // 几处公司就并发几条：两点驾车规划很轻，串行反而让下面几行一直挂着「正在规划」
    officeOrder.forEach((row) => {
      fetchGeoRoute(from, { lng: row.lng, lat: row.lat })
        .then((path) => {
          if (alive) setLegs((prev) => ({ ...prev, [row.uid]: path }));
        })
        .catch(() => {
          if (alive) setLegs((prev) => ({ ...prev, [row.uid]: null }));
        });
    });
    return () => {
      alive = false;
    };
    // officeSig 已经把「哪几处公司、坐标是什么」压成一行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, officeSig]);

  const back = (
    <div className="pick-page-bar">
      <button type="button" className="pick-btn" onClick={onBack}>
        ← 返回选房列表
      </button>
      {item ? <span className="pick-stamp">抓取 {fmtStamp(item.fetchedAt)}</span> : null}
    </div>
  );

  if (error) {
    return (
      <div className="pick-page">
        {back}
        <div className="card-inset pick-empty">详情没取到：{error}</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="pick-page">
        {back}
        <div className="card-inset pick-empty">正在读取楼盘详情…</div>
      </div>
    );
  }

  // 通勤路线页：同一份楼盘数据，只把「到公司怎么走」摊开
  if (sub === "route") {
    return (
      <PickRoutePage
        item={item}
        offices={commute.offices}
        preferredUid={hashPickOffice() || office?.uid || ""}
        onBack={() => {
          window.location.hash = "/picks/" + uid;
        }}
      />
    );
  }

  const coverSrc = coverStage === 0 ? "/covers/" + item.uid + ".jpg" : coverStage === 1 ? item.image || null : null;

  // 地图落点：抓数时换算成 GCJ-02 的才算数，0 也是没落到
  const hasMap =
    typeof item.lng === "number" && typeof item.lat === "number" && (item.lng !== 0 || item.lat !== 0);
  const amapHref = hasMap
    ? "https://uri.amap.com/marker?position=" +
      item.lng +
      "," +
      item.lat +
      "&name=" +
      encodeURIComponent(item.name) +
      "&coordinate=gaode&callnative=1&src=house-hub"
    : "";

  const facts: Array<[string, string]> = [
    ["区域 / 板块", item.district + (item.bizcircle ? " · " + item.bizcircle : "")],
    ["环线位置", item.ring || "—"],
    ["户型", item.layouts || "—"],
    ["面积段", item.areaText ? item.areaText.replace(/平米/g, "㎡") : "—"],
    ["物业类别", item.propertyType || "—"],
    ["建筑类别", item.buildingType || "—"],
    ["装修状况", item.decoration || "—"],
    ["产权年限", item.ownership || "—"],
    ["开发商", item.developer || "—"],
    ["开盘时间", item.openDate || "—"],
    ["交房时间", item.deliveryDate || "—"],
    ["售楼地址", item.salesAddress || "—"],
  ];

  return (
    <div className="pick-page">
      {back}
      <div className="card-inset pick-card pick-page-card">
        <div className="pick-page-grid">
          <div className="pick-page-media">
            <div className="pick-cover pick-cover-lg">
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt={item.name}
                  loading="lazy"
                  onError={() => setCoverStage((stage) => (stage < 2 ? stage + 1 : 2))}
                />
              ) : (
                <div className="pick-cover-empty">暂无效果图</div>
              )}
              <span className={"tag-pill pick-status pick-cover-tag" + statusClass(item.saleStatus)}>
                {item.saleStatus || "未知"}
              </span>
            </div>
            {item.tags.length ? (
              <div className="pick-tags">
                {item.tags.map((tag) => (
                  <span key={tag} className="tag-pill">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="pick-page-main">
            <div className="pick-head">
              <div>
                <div className="pick-title pick-title-lg">{item.name}</div>
                <div className="pick-sub">
                  {item.district}
                  {item.bizcircle ? " · " + item.bizcircle : ""}
                  {item.ring ? " · " + item.ring : ""} · 总价{" "}
                  {item.totalPriceFrom ? item.totalPriceFrom + " 万起" : "待定"}
                </div>
              </div>
              <div className="pick-price">
                <span className="n">{fmtAvg(item.priceAvg)}</span>
                <span>{item.priceText || ""}</span>
              </div>
            </div>
            <div className="pick-addr pick-addr-lg">{item.address || "地址待补"}</div>
            <div className="pick-facts pick-facts-grid">
              {facts.map(([label, value]) => (
                <div key={label} className="pick-fact">
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            <div className="pick-actions">
              {item.phone ? (
                <a className="pick-btn is-primary" href={"tel:" + item.phone}>
                  售楼处 {fmtPhone(item.phone)}
                </a>
              ) : null}
              {item.sourceUrl ? (
                <a className="pick-btn" href={item.sourceUrl} target="_blank" rel="noreferrer">
                  源页核对
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card-inset pick-card pick-page-card">
        <div className="pick-sec-head">
          <div className="pick-sec-title">楼盘位置</div>
          {hasMap ? (
            <div className="pick-sec-actions">
              <span className="pick-sec-hint">{item.address || item.salesAddress || ""}</span>
              <a className="pick-btn" href={amapHref} target="_blank" rel="noreferrer">
                高德打开 / 导航
              </a>
            </div>
          ) : null}
        </div>
        {hasMap ? (
          <AmapSpotMap name={item.name} address={item.address || item.salesAddress} lng={item.lng!} lat={item.lat!} />
        ) : (
          <div className="pick-empty">这个盘还没抓到坐标，暂时画不出位置；下方地址可以先对着看。</div>
        )}
        {hasMap && officeOrder.length ? (
          <div className="pick-commute-list">
            {officeOrder.map((row) => {
              const leg = legs[row.uid];
              const isDefault = row.uid === defaultUid;
              return (
                <button
                  key={row.uid}
                  type="button"
                  className={"pick-commute" + (isDefault ? " is-default" : "")}
                  onClick={() => openPickRoute(item.uid, row.uid)}
                >
                  <span className="pick-commute-lb">{isDefault ? "默认" : "公司"}</span>
                  <b className={"pick-commute-v" + (leg === null ? " is-warn" : "")}>
                    {leg === undefined
                      ? "正在规划…"
                      : leg === null
                        ? "路线没算出来"
                        : "驾车 " +
                          (leg.distance / 1000).toFixed(1) +
                          " km · 约 " +
                          Math.max(1, Math.round(leg.duration / 60)) +
                          " 分钟"}
                  </b>
                  <span className="pick-commute-to">{row.name}</span>
                  <span className="pick-commute-go">查路线 ›</span>
                </button>
              );
            })}
          </div>
        ) : hasMap ? (
          <div className="pick-commute is-off">
            {commute.phase === "loading"
              ? "正在读通勤档案…"
              : commute.phase === "unpaired"
                ? "设备还没配对，读不到公司地点"
                : "还没录公司地点，去「通勤档案」补一处，这里会按地点逐个算到公司多久"}
          </div>
        ) : null}
      </div>

      <div className="card-inset pick-card pick-page-card">
        <div className="pick-sec-head">
          <div className="pick-sec-title">
            户型 {item.floorPlans.length ? <span className="pick-sec-count">{item.floorPlans.length} 张</span> : null}
          </div>
          {item.sourceUrl ? (
            <div className="pick-sec-actions">
              <a className="pick-btn" href={item.sourceUrl} target="_blank" rel="noreferrer">
                源页户型
              </a>
            </div>
          ) : null}
        </div>
        <FloorPlanGallery plans={item.floorPlans} />
      </div>
    </div>
  );
}
